import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { listProjects, getCompactContextMulti } from "@/lib/data";

export const dynamic = "force-dynamic";

const client = new OpenAI({
  apiKey:  process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
  baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
});

// ═══════════════════════════════════════════════════════════════
// System Prompt — Component Schema Contract
// ═══════════════════════════════════════════════════════════════
const SYSTEM_PROMPT = `
你是一个调研数据可视化调度引擎（GenUI Engine）。
用户给你一段自然语言问题，你需要从提供的调研 JSON 数据中提取真实数据，
返回一个可被前端动态渲染的 JSON 布局配置。

━━━━━━ 可用组件 & 精确 Schema ━━━━━━

1. StatCard — 单项关键指标
   {"component":"StatCard","span":"half","label":"标签文字","value":"数值或文字","sub":"补充说明(可选)","gradient":"linear-gradient(135deg,#00c9a7,#818cf8)(可选)"}

2. NumberRow — 一行多个指标（自动填满整行）
   {"component":"NumberRow","span":"full","items":[{"label":"...","value":"...","sub":"...","color":"#00c9a7"},...]}

3. BarChart — 水平条形排行图
   {"component":"BarChart","span":"half","title":"...","data":[{"name":"标签名","value":整数,"color":"#hex(可选)"},...]  }

4. CompareBar — 双列对比条形图（适合两组数据横向对比）
   {"component":"CompareBar","span":"full","title":"...","groups":[
     {"label":"组A","color":"#818cf8","data":[{"name":"...","value":整数},...  ]},
     {"label":"组B","color":"#00c9a7","data":[{"name":"...","value":整数},...]}
   ]}

5. DonutChart — 环形占比图
   {"component":"DonutChart","span":"half","title":"...","centerLabel":"中心大字","centerSub":"中心小字","data":[{"name":"...","value":整数,"color":"#hex(可选)"},...]}

6. AreaChart — 面积趋势图（需要时序或分组数据）
   {"component":"AreaChart","span":"full","title":"...","xKey":"week","data":[{"week":"标签",...系列key:值...}],"lines":[{"key":"系列key","label":"图例","color":"#hex"},...]}

7. RadarChart — 蛛网/雷达图（多维度对比）
   {"component":"RadarChart","span":"half","title":"...","data":[{"subject":"维度名","value":0-100},...]}

8. QuoteCards — 用户原声瀑布流（全宽）
   {"component":"QuoteCards","span":"full","title":"...","quotes":[{
     "id":"唯一id","title":"帖子标题(可空)","content":"正文摘要(≤120字)","sentiment":"positive|negative|neutral",
     "tags":["tag1"],"pain_points":["痛点1"],"author":"昵称","likes":整数,"collects":整数,"comments":整数,"platform":"小红书"
   },...]}

━━━━━━ 输出格式（严格 JSON，禁止输出任何 Markdown 或注释）━━━━━━

{
  "answer": "一句话结论，说明本次分析发现了什么",
  "layout": [
    { "component": "组件类型", "span": "half|full", ...该组件专属字段 },
    ...
  ]
}

━━━━━━ 布局规则 ━━━━━━
- span="full" 的组件占满整行
- span="half" 的组件两两并排
- 一般先放 NumberRow 或 StatCard 做总览，再放详细图表，最后可选 QuoteCards
- 对比类问题优先用 CompareBar；占比类用 DonutChart；排名类用 BarChart
- 数据必须来自上下文，禁止捏造任何数字
- 每次 layout 返回 2~6 个组件，不要过多
`.trim();

// ═══════════════════════════════════════════════════════════════
// Request handler
// ═══════════════════════════════════════════════════════════════

export interface GenerateDashboardRequest {
  query:  string;
  slugs?: string[];   // which projects to include; empty = all with data
}

export interface LayoutItem {
  component: string;
  span?:     "half" | "full";
  title?:    string;
  [key: string]: unknown;
}

export interface DashboardLayout {
  answer: string;
  layout: LayoutItem[];
}

export async function GET() {
  // Returns list of available projects for the project selector
  const projects = listProjects().map((p) => ({
    slug:        p.slug,
    name:        p.name,
    goal:        p.goal,
    hasData:     p.hasData,
    lastAnalyzed:p.lastAnalyzed,
  }));
  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Partial<GenerateDashboardRequest>;
  const { query, slugs } = body;

  if (!query?.trim()) {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  // Resolve which projects to include
  const allWithData = listProjects()
    .filter((p) => p.hasData)
    .map((p) => p.slug);

  const targetSlugs =
    slugs && slugs.length > 0
      ? slugs.filter((s) => allWithData.includes(s))
      : allWithData;

  if (targetSlugs.length === 0) {
    return NextResponse.json(
      { error: "No analysed projects found. Run clean_data.py first." },
      { status: 404 }
    );
  }

  // Build compact context for each project
  const contexts = getCompactContextMulti(targetSlugs);

  // Wrap in a single user message
  const contextBlock = contexts.length === 1
    ? JSON.stringify(contexts[0], null, 0)
    : JSON.stringify(
        contexts.map((c) => ({ project: c.slug, ...c })),
        null, 0
      );

  const userMsg = `用户问题：${query.trim()}\n\n调研数据（JSON）：\n${contextBlock}`;

  try {
    const resp = await client.chat.completions.create({
      model:           process.env.AI_MODEL ?? "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userMsg },
      ],
      temperature:     0.25,
      response_format: { type: "json_object" },
    });

    const raw = resp.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw) as DashboardLayout;

    // Normalise: accept both "layout" and "components" keys from the model
    if (!parsed.layout && (parsed as Record<string, unknown>).components) {
      parsed.layout = (parsed as Record<string, unknown>).components as LayoutItem[];
    }
    parsed.layout ??= [];

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[generate-dashboard]", err);
    return NextResponse.json({ error: "LLM call failed" }, { status: 500 });
  }
}
