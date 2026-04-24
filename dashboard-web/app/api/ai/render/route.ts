import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getProjectAnalysis } from "@/lib/data";

export const dynamic = "force-dynamic";

const client = new OpenAI({
  apiKey:  process.env.DEEPSEEK_API_KEY ?? process.env.OPENAI_API_KEY ?? "",
  baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
});

const SYSTEM_PROMPT = `
你是一个数据可视化决策引擎。用户会用中文提问，你需要从提供的调研 JSON 数据中提取相关子集，
返回一个可视化渲染方案。

可用的组件类型（component 字段）：
- "AreaChart"  : 趋势/时序数据。字段：xKey(string)、lines:[{key,label,color}]、data:[]
- "DonutChart" : 占比分布。字段：data:[{name,value,color?}]、centerLabel、centerSub
- "BarChart"   : 排行/频次条形图。字段：data:[{name,value,color?}]
- "QuoteCards" : 用户原声卡片流。字段：quotes:[{id,title,content,sentiment,tags,pain_points,author,likes,collects,comments,platform}]
- "StatCard"   : 单项指标。字段：label、value、sub、gradient

严格返回 JSON，格式：
{
  "answer": "一句话结论",
  "components": [
    { "component": "组件类型", "title": "标题", ...组件专属字段 }
  ]
}
不要输出任何多余文字。
`.trim();

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { query?: string; slug?: string };
  const { query, slug } = body;

  if (!query || !slug) {
    return NextResponse.json({ error: "Missing query or slug" }, { status: 400 });
  }

  const analysis = getProjectAnalysis(slug);
  if (!analysis) {
    return NextResponse.json({ error: "No analysis data found" }, { status: 404 });
  }

  // Compact context — keep token cost manageable
  const context = JSON.stringify({
    meta:                analysis.meta,
    aggregate_insights:  analysis.aggregate_insights,
    tag_frequency:       analysis.tag_frequency,
    sentiment_breakdown: analysis.sentiment_breakdown,
    posts_sample:        analysis.posts.slice(0, 20).map((p) => ({
      note_id:       p.note_id,
      title:         p.title,
      content:       p.content?.slice(0, 100),
      author:        p.author,
      likes:         p.likes,
      collects:      p.collects,
      comments:      p.comments,
      platform:      p.platform,
      sentiment:     p.llm_analysis?.sentiment,
      tags:          p.llm_analysis?.tags,
      pain_points:   p.llm_analysis?.pain_points,
      desires:       p.llm_analysis?.desires,
      summary:       p.llm_analysis?.summary,
      quality_score: p.llm_analysis?.quality_score,
    })),
  });

  try {
    const resp = await client.chat.completions.create({
      model:           process.env.AI_MODEL ?? "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: `用户问题：${query}\n\n调研数据：\n${context}` },
      ],
      temperature:     0.3,
      response_format: { type: "json_object" },
    });

    const raw = resp.choices[0].message.content ?? "{}";
    return NextResponse.json(JSON.parse(raw));
  } catch (err) {
    console.error("[AI Render Route]", err);
    return NextResponse.json({ error: "LLM call failed" }, { status: 500 });
  }
}
