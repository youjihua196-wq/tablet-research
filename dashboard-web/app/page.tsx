/**
 * app/page.tsx — Aurora Research Dashboard 主看板
 *
 * 架构：Server Component（布局 + 静态数据传递）
 *   └─ Client Components（所有 Recharts 图表 + MasonryCards）
 *
 * 路由规范：
 *   /              本页（看板主视图，全屏沉浸式）
 *   /projects/[slug]   真实项目数据详情页（独立全屏路由）
 *
 * 严格禁止：半屏浮层 / 侧边抽屉
 */

import Link from "next/link";
import dynamic from "next/dynamic";
import {
  mockMeta,
  trendData,
  brandData,
  sentimentData,
  priceData,
  painPoints,
  userQuotes,
  aggregateInsights,
} from "@/lib/mock-data";

// ── 动态引入 Client 图表组件（避免 SSR 渲染 Recharts 的 window 依赖）──
const AuroraAreaChart   = dynamic(() => import("@/components/charts/AuroraAreaChart"),   { ssr: false });
const AuroraDonutChart  = dynamic(() => import("@/components/charts/AuroraDonutChart"),  { ssr: false });
const AuroraMasonryCards= dynamic(() => import("@/components/charts/AuroraMasonryCards"),{ ssr: false });

// ══════════════════════════════════════════════════════════════
// Sub-components (Server-renderable, no client APIs)
// ══════════════════════════════════════════════════════════════

/** 顶部统计卡片 */
function StatCard({
  label,
  value,
  sub,
  gradient,
  delay = 0,
}: {
  label:     string;
  value:     string;
  sub?:      string;
  gradient:  string;
  delay?:    number;
}) {
  return (
    <div
      style={{
        background:   "#0c1525",
        border:       "1px solid #1a2e4a",
        borderRadius: "16px",
        padding:      "20px 22px",
        position:     "relative",
        overflow:     "hidden",
        animationDelay: `${delay}ms`,
      }}
      className="animate-fade-in-up"
    >
      {/* Subtle corner glow */}
      <div
        style={{
          position:   "absolute",
          top:        -40,
          right:      -40,
          width:      100,
          height:     100,
          borderRadius: "50%",
          background: gradient.replace("135deg", "center"),
          opacity:    0.12,
          filter:     "blur(24px)",
          pointerEvents: "none",
        }}
      />
      <p style={{ color: "#4f6490", fontSize: "11px", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
        {label}
      </p>
      <p
        style={{
          fontSize:   "28px",
          fontWeight: 800,
          background: gradient,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          lineHeight: 1.2,
          marginBottom: 6,
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ color: "#39527a", fontSize: "12px" }}>{sub}</p>
      )}
    </div>
  );
}

/** 面板容器 */
function Panel({
  children,
  style,
  className,
}: {
  children:   React.ReactNode;
  style?:     React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background:   "#0c1525",
        border:       "1px solid #1a2e4a",
        borderRadius: "20px",
        padding:      "24px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** 面板标题 */
function PanelTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <p style={{ color: "#e0e8ff", fontSize: "15px", fontWeight: 600, marginBottom: 4 }}>
        {title}
      </p>
      {sub && <p style={{ color: "#4f6490", fontSize: "12px" }}>{sub}</p>}
    </div>
  );
}

/** 痛点排行列表 */
const SEVERITY_COLOR: Record<string, string> = {
  high:   "#fb7185",
  medium: "#fbbf24",
  low:    "#818cf8",
};
const SEVERITY_LABEL: Record<string, string> = {
  high: "高", medium: "中", low: "低",
};

function PainPointList() {
  const max = painPoints[0]?.frequency ?? 1;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {painPoints.map((pt, i) => {
        const color = SEVERITY_COLOR[pt.severity] ?? "#818cf8";
        const pct   = (pt.frequency / max) * 100;
        return (
          <div key={i}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: 6 }}>
              {/* Rank */}
              <span style={{ color: "#39527a", fontSize: "12px", width: 16, textAlign: "center", flexShrink: 0 }}>
                {i + 1}
              </span>
              {/* Point */}
              <span style={{ color: "#b4c6ef", fontSize: "13px", flex: 1 }}>
                {pt.point}
              </span>
              {/* Severity badge */}
              <span
                style={{
                  padding:      "1px 7px",
                  borderRadius: "20px",
                  background:   `${color}18`,
                  color,
                  fontSize:     "10px",
                  fontWeight:   600,
                  flexShrink:   0,
                }}
              >
                {SEVERITY_LABEL[pt.severity]}
              </span>
              {/* Count */}
              <span style={{ color, fontSize: "12px", fontWeight: 700, minWidth: 28, textAlign: "right", flexShrink: 0 }}>
                {pt.frequency}
              </span>
            </div>
            {/* Progress bar */}
            <div
              style={{
                marginLeft: 26,
                height:     4,
                background: "rgba(26,46,74,0.8)",
                borderRadius: 2,
                overflow:   "hidden",
              }}
            >
              <div
                style={{
                  width:      `${pct}%`,
                  height:     "100%",
                  background: `linear-gradient(90deg, ${color}99, ${color})`,
                  borderRadius: 2,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 用户期望列表 */
function DesiresList() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {aggregateInsights.top_desires.slice(0, 5).map((d, i) => {
        const colors = ["#00c9a7", "#60a5fa", "#a78bfa", "#f472b6", "#22d3ee"];
        const c = colors[i % colors.length];
        return (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
            <span
              style={{
                width:       20,
                height:      20,
                borderRadius: "50%",
                background:  `${c}20`,
                border:      `1px solid ${c}50`,
                color:       c,
                fontSize:    "10px",
                fontWeight:  700,
                display:     "flex",
                alignItems:  "center",
                justifyContent: "center",
                flexShrink:  0,
                marginTop:   2,
              }}
            >
              {i + 1}
            </span>
            <div style={{ flex: 1 }}>
              <p style={{ color: "#b4c6ef", fontSize: "13px", lineHeight: 1.5 }}>
                {d.desire}
              </p>
              <p style={{ color: "#39527a", fontSize: "11px", marginTop: 2 }}>
                ×{d.frequency} 次提及
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 建议卡片 */
function RecommendationList() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {aggregateInsights.key_recommendations.map((rec, i) => (
        <div
          key={i}
          style={{
            display:      "flex",
            gap:          "12px",
            padding:      "12px 14px",
            background:   "rgba(26,46,74,0.4)",
            borderRadius: "12px",
            border:       "1px solid rgba(26,46,74,0.8)",
          }}
        >
          <span
            style={{
              fontSize:   "18px",
              lineHeight: 1.4,
              flexShrink: 0,
            }}
          >
            {["💡", "🔋", "🛡️", "🎯"][i] ?? "✦"}
          </span>
          <p style={{ color: "#8ea3cb", fontSize: "13px", lineHeight: 1.6 }}>{rec}</p>
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Area chart data wiring
// ══════════════════════════════════════════════════════════════
const areaLines = [
  { key: "positive", label: "正面", color: "#00c9a7" },
  { key: "negative", label: "负面", color: "#fb7185" },
  { key: "neutral",  label: "中性", color: "#818cf8" },
];

// ══════════════════════════════════════════════════════════════
// Page
// ══════════════════════════════════════════════════════════════
export default function DashboardPage() {
  const successRate = mockMeta.total_raw
    ? ((mockMeta.success / mockMeta.total_raw) * 100).toFixed(1)
    : "0";

  const posRate = (253 + 0) > 0
    ? ((148 / 253) * 100).toFixed(1)
    : "0";

  return (
    <main
      style={{
        minHeight:  "100vh",
        padding:    "0 0 80px",
      }}
    >
      {/* ── Header ─────────────────────────────────────────── */}
      <header
        style={{
          borderBottom: "1px solid rgba(26,46,74,0.7)",
          background:   "rgba(6,11,24,0.7)",
          backdropFilter: "blur(16px)",
          position:     "sticky",
          top:          0,
          zIndex:       50,
        }}
      >
        <div
          style={{
            maxWidth: 1280,
            margin:   "0 auto",
            padding:  "0 32px",
            height:   64,
            display:  "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Logo + Title */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width:        34,
                height:       34,
                borderRadius: "10px",
                background:   "linear-gradient(135deg, #00c9a7, #818cf8)",
                display:      "flex",
                alignItems:   "center",
                justifyContent: "center",
                fontSize:     "16px",
                fontWeight:   900,
                color:        "#060b18",
              }}
            >
              R
            </div>
            <div>
              <span
                style={{ fontSize: "15px", fontWeight: 700, color: "#e0e8ff" }}
              >
                Aurora Research
              </span>
              <span
                style={{
                  marginLeft: 10,
                  padding:    "2px 8px",
                  borderRadius: "20px",
                  background: "rgba(0,201,167,0.12)",
                  color:      "#00c9a7",
                  fontSize:   "11px",
                  fontWeight: 600,
                }}
              >
                MOCK DATA
              </span>
            </div>
          </div>

          {/* Meta info */}
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <span style={{ color: "#39527a", fontSize: "12px" }}>
              模型：{mockMeta.model}
            </span>
            <span style={{ color: "#39527a", fontSize: "12px" }}>
              分析时间：{mockMeta.processed_at.slice(0, 10)}
            </span>
            <div
              style={{
                display:      "flex",
                alignItems:   "center",
                gap:          6,
                padding:      "6px 14px",
                borderRadius: "20px",
                background:   "rgba(26,46,74,0.6)",
                border:       "1px solid rgba(26,46,74,0.9)",
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#00c9a7", display: "inline-block" }} />
              <span style={{ color: "#6b82ab", fontSize: "12px" }}>Live Dashboard</span>
            </div>

            {/* GenUI Studio entry */}
            <Link
              href="/studio"
              style={{
                display:      "flex",
                alignItems:   "center",
                gap:          7,
                padding:      "6px 14px",
                borderRadius: "20px",
                background:   "linear-gradient(135deg,rgba(0,201,167,0.12),rgba(129,140,248,0.12))",
                border:       "1px solid rgba(0,201,167,0.25)",
                textDecoration: "none",
                transition:   "border-color 0.2s",
              }}
            >
              <span style={{ fontSize: "14px" }}>✦</span>
              <span
                style={{
                  fontSize:   "12px",
                  fontWeight: 600,
                  background: "linear-gradient(90deg,#00c9a7,#818cf8)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor:  "transparent",
                  backgroundClip: "text",
                }}
              >
                GenUI Studio
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div
        style={{ maxWidth: 1280, margin: "0 auto", padding: "40px 32px 0" }}
      >

        {/* ── Hero title + executive summary ──────────────────── */}
        <section style={{ marginBottom: 40 }}>
          <h1
            style={{
              fontSize:   "32px",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              background: "linear-gradient(90deg, #e0e8ff 0%, #818cf8 60%, #00c9a7 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
              marginBottom: 10,
              lineHeight:   1.25,
            }}
          >
            {mockMeta.goal_summary}
          </h1>
          <p
            style={{
              maxWidth:   700,
              color:      "#6b82ab",
              fontSize:   "14px",
              lineHeight: 1.7,
            }}
          >
            {aggregateInsights.executive_summary}
          </p>
        </section>

        {/* ── Stat cards row ───────────────────────────────────── */}
        <section
          style={{
            display:             "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap:                 "16px",
            marginBottom:        "28px",
          }}
        >
          <StatCard
            label="原始帖子总数"
            value={`${mockMeta.total_raw}`}
            sub={`成功分析 ${mockMeta.success} 条`}
            gradient="linear-gradient(135deg, #00c9a7, #22d3ee)"
            delay={0}
          />
          <StatCard
            label="分析成功率"
            value={`${successRate}%`}
            sub={`${mockMeta.errors} 条解析异常`}
            gradient="linear-gradient(135deg, #60a5fa, #818cf8)"
            delay={80}
          />
          <StatCard
            label="正面情感占比"
            value={`${posRate}%`}
            sub="负面 28.5% · 中性 13.0%"
            gradient="linear-gradient(135deg, #a78bfa, #f472b6)"
            delay={160}
          />
          <StatCard
            label="最高频痛点"
            value="价格太贵"
            sub="38 次提及 · 严重程度：高"
            gradient="linear-gradient(135deg, #fb7185, #fbbf24)"
            delay={240}
          />
        </section>

        {/* ── Charts row 1: AreaChart (2/3) + DonutChart (1/3) ── */}
        <section
          style={{
            display:             "grid",
            gridTemplateColumns: "2fr 1fr",
            gap:                 "20px",
            marginBottom:        "20px",
          }}
        >
          {/* Area chart */}
          <Panel>
            <PanelTitle
              title="情感趋势（周维度）"
              sub="正面 / 负面 / 中性帖子数量变化"
            />
            <AuroraAreaChart
              data={trendData}
              lines={areaLines}
              xKey="week"
              height={280}
            />
          </Panel>

          {/* Brand donut */}
          <Panel>
            <PanelTitle
              title="竞品提及分布"
              sub="用户帖子中出现的品牌频次"
            />
            <AuroraDonutChart
              data={brandData.map((b) => ({
                name:  b.name,
                value: b.value,
                color:
                  b.sentiment === "positive" ? "#00c9a7"
                  : b.sentiment === "negative" ? "#fb7185"
                  : "#818cf8",
              }))}
              size={90}
              centerLabel="100"
              centerSub="总提及次数"
              showLegend
            />
          </Panel>
        </section>

        {/* ── Charts row 2: Sentiment + Price + Pain points ───── */}
        <section
          style={{
            display:             "grid",
            gridTemplateColumns: "1fr 1fr 1.4fr",
            gap:                 "20px",
            marginBottom:        "20px",
          }}
        >
          {/* Sentiment donut */}
          <Panel>
            <PanelTitle
              title="情感分布"
              sub="所有分析帖子的情感占比"
            />
            <AuroraDonutChart
              data={sentimentData}
              size={88}
              centerLabel="253"
              centerSub="有效样本"
              showLegend
            />
          </Panel>

          {/* Price sensitivity donut */}
          <Panel>
            <PanelTitle
              title="价格敏感度"
              sub="用户的价格接受程度分布"
            />
            <AuroraDonutChart
              data={priceData}
              size={88}
              centerLabel="253"
              centerSub="有效样本"
              showLegend
            />
          </Panel>

          {/* Pain points */}
          <Panel>
            <PanelTitle
              title="核心痛点 TOP 7"
              sub="出现频次 · 严重程度标注"
            />
            <PainPointList />
          </Panel>
        </section>

        {/* ── Row 3: Desires + Recommendations ─────────────────── */}
        <section
          style={{
            display:             "grid",
            gridTemplateColumns: "1fr 1fr",
            gap:                 "20px",
            marginBottom:        "40px",
          }}
        >
          <Panel>
            <PanelTitle
              title="用户核心期望"
              sub="用户最希望改善的方向（按提及频次）"
            />
            <DesiresList />
          </Panel>

          <Panel>
            <PanelTitle
              title="产品洞察建议"
              sub="基于 LLM 聚合分析生成的行动建议"
            />
            <RecommendationList />
          </Panel>
        </section>

        {/* ── Full-width Masonry: User Quotes ──────────────────── */}
        <section>
          {/* Section header */}
          <div
            style={{
              display:      "flex",
              alignItems:   "center",
              gap:          "14px",
              marginBottom: "24px",
            }}
          >
            <div
              style={{
                flex:         "0 0 3px",
                height:       "28px",
                borderRadius: "2px",
                background:   "linear-gradient(180deg, #00c9a7, #818cf8)",
              }}
            />
            <div>
              <h2 style={{ color: "#e0e8ff", fontSize: "18px", fontWeight: 700, marginBottom: 3 }}>
                用户原声精选
              </h2>
              <p style={{ color: "#4f6490", fontSize: "12px" }}>
                {userQuotes.length} 条真实帖子 · 情感着色 · 痛点标注
              </p>
            </div>
          </div>

          <AuroraMasonryCards
            quotes={userQuotes}
            columns={3}
          />
        </section>

        {/* ── Footer ──────────────────────────────────────────── */}
        <footer
          style={{
            marginTop:  "60px",
            paddingTop: "24px",
            borderTop:  "1px solid rgba(26,46,74,0.5)",
            display:    "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p style={{ color: "#39527a", fontSize: "12px" }}>
            Aurora Research Dashboard · Powered by {mockMeta.model}
          </p>
          <p style={{ color: "#39527a", fontSize: "12px" }}>
            Pipeline: MediaCrawler → Data_Engine → Dashboard_Web
          </p>
        </footer>
      </div>
    </main>
  );
}
