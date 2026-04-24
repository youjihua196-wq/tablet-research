// ─────────────────────────────────────────────────────────────
// lib/mock-data.ts
// 模拟数据集：模拟 clean_data.py 输出的 latest.json 结构，
// 用于在真实数据接入前展示完整的 Dashboard 效果。
// ─────────────────────────────────────────────────────────────

// ── 1. 项目元信息 ─────────────────────────────────────────────
export const mockMeta = {
  project:         "01_College_Students",
  goal_summary:    "大学生平板电脑使用场景与需求分析",
  model:           "deepseek-chat",
  processed_at:    "2025-04-18T14:32:07.412",
  total_raw:       286,
  total_analyzed:  269,
  success:         253,
  errors:          16,
  concurrency:     3,
  elapsed_seconds: 412.8,
};

// ── 2. 情感趋势数据（周维度，供 AreaChart 使用）──────────────
export interface TrendPoint {
  week:     string;
  total:    number;
  positive: number;
  negative: number;
  neutral:  number;
}

export const trendData: TrendPoint[] = [
  { week: "2月W1", total: 15, positive:  8, negative:  4, neutral: 3 },
  { week: "2月W2", total: 23, positive: 12, negative:  7, neutral: 4 },
  { week: "2月W3", total: 31, positive: 16, negative: 10, neutral: 5 },
  { week: "3月W1", total: 28, positive: 14, negative:  9, neutral: 5 },
  { week: "3月W2", total: 42, positive: 20, negative: 15, neutral: 7 },
  { week: "3月W3", total: 38, positive: 18, negative: 13, neutral: 7 },
  { week: "4月W1", total: 51, positive: 25, negative: 18, neutral: 8 },
  { week: "4月W2", total: 67, positive: 31, negative: 26, neutral: 10 },
];

// ── 3. 竞品提及分布（供 DonutChart 使用）────────────────────
export interface BrandItem {
  name:      string;
  value:     number;
  sentiment: "positive" | "negative" | "neutral";
}

export const brandData: BrandItem[] = [
  { name: "iPad",          value: 45, sentiment: "positive" },
  { name: "华为MatePad",   value: 22, sentiment: "neutral"  },
  { name: "小米平板",      value: 15, sentiment: "positive" },
  { name: "三星 Galaxy",   value:  8, sentiment: "negative" },
  { name: "联想小新Pad",   value:  7, sentiment: "neutral"  },
  { name: "其他",          value:  3, sentiment: "neutral"  },
];

// ── 4. 情感分布（供第二个 DonutChart 使用）──────────────────
export const sentimentData = [
  { name: "正面",  value: 148, color: "#00c9a7" },
  { name: "负面",  value:  72, color: "#fb7185" },
  { name: "中性",  value:  33, color: "#818cf8" },
];

// ── 5. 价格敏感度分布 ────────────────────────────────────────
export const priceData = [
  { name: "高度敏感", value: 109, color: "#fb7185" },
  { name: "中等敏感", value:  84, color: "#fbbf24" },
  { name: "低敏感",   value:  38, color: "#00c9a7" },
  { name: "未明确",   value:  22, color: "#6b82ab" },
];

// ── 6. 核心痛点（TOP 7）───────────────────────────────────────
export interface PainPoint {
  point:     string;
  frequency: number;
  severity:  "high" | "medium" | "low";
}

export const painPoints: PainPoint[] = [
  { point: "价格太贵（含配件）",       frequency: 38, severity: "high"   },
  { point: "电池续航焦虑",             frequency: 31, severity: "high"   },
  { point: "无法完全替代电脑",         frequency: 27, severity: "medium" },
  { point: "手写笔/键盘额外收费",      frequency: 24, severity: "medium" },
  { point: "专业软件生态不完善",       frequency: 18, severity: "medium" },
  { point: "散热性能差",               frequency: 12, severity: "low"    },
  { point: "系统封闭/生态割裂",        frequency:  9, severity: "low"    },
];

// ── 7. 聚合洞察 ──────────────────────────────────────────────
export const aggregateInsights = {
  executive_summary:
    "大学生群体对平板电脑的需求以学习工具（记笔记、看网课）为主，但普遍存在「购前期待过高、购后使用场景单一」的落差。iPad 在生态和体验上占据绝对心智，但其高价格（含 Apple Pencil 及键盘妙控套件）已构成明显的劝退因素。国产平板在性价比上具备吸引力，但软件生态与系统稳定性不足令用户犹豫。续航与配件定价是两大共性痛点，跨越了品牌偏好。",
  top_desires: [
    { desire: "开箱即用的学习配件套装（笔+键盘）",   frequency: 31 },
    { desire: "更长的单次续航（12h+）",              frequency: 27 },
    { desire: "主流专业软件（Office/PS）完整支持",    frequency: 22 },
    { desire: "更合理的价格区间（3000~5000元）",     frequency: 19 },
    { desire: "轻量化机身（500g 以内）",              frequency: 14 },
  ],
  top_use_scenarios: [
    "课堂手写笔记",
    "观看网课/慕课",
    "PDF 论文阅读标注",
    "宿舍娱乐（视频/游戏）",
    "创作（绘图/音乐）",
  ],
  key_recommendations: [
    "推出含笔+键盘的「开学礼包」套装，打包定价降低感知门槛",
    "强化续航宣传指标，以实际使用场景为单位（如「8节课不插电」）",
    "开发面向大学生的垂类 App（笔记/资料管理），构建学习生态护城河",
    "针对理工科/艺术类学生做场景化精准营销，突破「平板=娱乐」刻板印象",
  ],
};

// ── 8. 用户原声（供 MasonryCards 使用）─────────────────────
export interface UserQuote {
  id:          string;
  title:       string;
  content:     string;
  author:      string;
  platform:    string;
  sentiment:   "positive" | "negative" | "neutral";
  pain_points: string[];
  tags:        string[];
  likes:       number;
  collects:    number;
  comments:    number;
}

export const userQuotes: UserQuote[] = [
  {
    id: "q1",
    title: "用了iPad一学期的真实感受",
    content:
      "笔记效果确实好，但 Apple Pencil 第二代要 1000 块，键盘妙控要 1800，直接要我老命。" +
      "本来预算 5000 买 iPad，结果全套下来快 9000 了。宿舍姐妹问我值不值——" +
      "我只能说，父母给钱买当然值，要是自己兼职攒的，就别折磨自己了😭",
    author:    "小林同学",
    platform:  "小红书",
    sentiment: "negative",
    pain_points: ["价格太贵", "配件贵"],
    tags:      ["iPad", "价格", "配件", "学习"],
    likes:     1243, collects: 892, comments: 178,
  },
  {
    id: "q2",
    title: "华为MatePad Pro记笔记真香",
    content:
      "平板记笔记比纸质好太多了！我是理工科，数学公式手写识别很准，" +
      "一学期笔记全在平板里，再也不用背几公斤书去图书馆。强烈推荐！",
    author:    "理工小姐姐",
    platform:  "小红书",
    sentiment: "positive",
    pain_points: [],
    tags:      ["华为MatePad", "记笔记", "学习效率", "推荐"],
    likes:     867, collects: 634, comments: 92,
  },
  {
    id: "q3",
    title: "平板替代不了电脑，这是真的",
    content:
      "什么「平板能替代电脑」的谎言，骗了多少大学生。写论文、装专业软件、多窗口处理——" +
      "还是得用电脑。平板说白了就是个大手机，娱乐凑合，生产力别指望。",
    author:    "理性er",
    platform:  "小红书",
    sentiment: "negative",
    pain_points: ["无法替代电脑", "专业软件缺失"],
    tags:      ["生产力", "失望", "电脑"],
    likes:     2198, collects: 1560, comments: 304,
  },
  {
    id: "q4",
    title: "iPad mini 6 — 娱乐党选购指南",
    content:
      "对比了好久，最后买了 mini 6。我主要是宿舍床上看剧、刷课、偶尔画画，8.3 寸刚好。" +
      "如果你是要认真记笔记，可能 Pro 系列更合适。根据自己需求买！",
    author:    "娱乐至上",
    platform:  "小红书",
    sentiment: "neutral",
    pain_points: [],
    tags:      ["iPad mini", "选购建议", "娱乐"],
    likes:     543, collects: 411, comments: 67,
  },
  {
    id: "q5",
    title: "续航焦虑：我的平板用电心得",
    content:
      "续航真的是硬伤。上午两节课记笔记，中午吃饭没充电，下午还没上完课就没电了。" +
      "出门总要带充电宝，充电速度又慢，感觉花大钱买了个焦虑。" +
      "充电头还要另外买……苹果你良心呢？",
    author:    "充电焦虑症患者",
    platform:  "小红书",
    sentiment: "negative",
    pain_points: ["续航短", "充电慢"],
    tags:      ["续航", "苹果", "焦虑"],
    likes:     1876, collects: 1102, comments: 241,
  },
  {
    id: "q6",
    title: "小米平板6 Pro 真的是学生党神器",
    content:
      "小米平板 6 Pro 才是性价比之王！比 iPad 便宜一半，性能完全够用，" +
      "看论文、记笔记、刷剧都 ok。还是官方鼠标键盘套件体验好，学生党必选！",
    author:    "性价比侦探",
    platform:  "小红书",
    sentiment: "positive",
    pain_points: [],
    tags:      ["小米", "性价比", "推荐", "学生党"],
    likes:     3421, collects: 2788, comments: 512,
  },
  {
    id: "q7",
    title: "大四的我给大一新生的建议",
    content:
      "大四了才来聊这个话题。大一大二买用处不大，很容易变成刷剧神器。" +
      "大三大四做毕设才有点用。而且我们院部分专业软件只有 Windows 版，iPad 直接废一半功能。" +
      "买之前先问清楚自己的专业需求！",
    author:    "大四老学长",
    platform:  "小红书",
    sentiment: "neutral",
    pain_points: ["专业软件缺失"],
    tags:      ["理性建议", "专业软件", "毕业设计"],
    likes:     4102, collects: 3567, comments: 689,
  },
  {
    id: "q8",
    title: "买了平板我还是那个我",
    content:
      "买之前被种草帖子骗了，感觉买了平板就能变成学神。" +
      "买了之后发现：还是一样刷手机，只不过多了个大屏幕刷视频而已。" +
      "自制力比设备重要，这是血泪教训。",
    author:    "当年的我",
    platform:  "小红书",
    sentiment: "negative",
    pain_points: ["学习效率未提升"],
    tags:      ["自制力", "失望", "学习效率"],
    likes:     5689, collects: 4213, comments: 823,
  },
  {
    id: "q9",
    title: "学美术的同学快来！",
    content:
      "学美术强烈推荐 iPad！配合 Procreate 简直太爽，随时随地可以画，老师改稿也方便。" +
      "比起传统画板省了多少耗材。已经用了两年，真的超值。",
    author:    "美院小画手",
    platform:  "小红书",
    sentiment: "positive",
    pain_points: [],
    tags:      ["美术", "iPad", "Procreate", "专业"],
    likes:     2345, collects: 1987, comments: 267,
  },
  {
    id: "q10",
    title: "后悔买三星平板",
    content:
      "三星 Galaxy Tab S9 买了半年，系统更新太慢，很多 App 没有平板适配版，" +
      "大屏体验还不如 iPad。安卓生态真的还差一截，后悔了。",
    author:    "踩雷的人",
    platform:  "小红书",
    sentiment: "negative",
    pain_points: ["系统生态差", "App 适配差"],
    tags:      ["三星", "系统", "生态", "后悔"],
    likes:     1123, collects: 876, comments: 198,
  },
];
