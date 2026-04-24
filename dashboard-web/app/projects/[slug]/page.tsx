import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectAnalysis, type PostData } from "@/lib/data";
import AiQueryPanel from "@/components/AiQueryPanel";
import {
  SentimentPie,
  TagFrequencyBar,
  PainPointsBar,
  CompetitiveBar,
  PriceRadar,
} from "@/components/Charts";

export const dynamic = "force-dynamic";

// ── Stat Card ───────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <p className="text-xs mb-2 uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <p
        className="text-3xl font-bold mb-1"
        style={{ color: accent ?? "var(--text)" }}
      >
        {value}
      </p>
      {sub && <p className="text-xs" style={{ color: "var(--muted)" }}>{sub}</p>}
    </div>
  );
}

// ── Section Card ────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border p-6"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <h3 className="font-semibold mb-5" style={{ color: "var(--text)" }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Severity Badge ───────────────────────────────────────
function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { label: string; bg: string; text: string }> = {
    high: { label: "高", bg: "bg-red-500/15", text: "text-red-400" },
    medium: { label: "中", bg: "bg-amber-500/15", text: "text-amber-400" },
    low: { label: "低", bg: "bg-emerald-500/15", text: "text-emerald-400" },
  };
  const s = map[severity] ?? { label: severity, bg: "bg-gray-500/15", text: "text-gray-400" };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  );
}

// ── Post Card ────────────────────────────────────────────
function PostCard({ post, slug }: { post: PostData; slug: string }) {
  const a = post.llm_analysis;
  const sentimentStyle: Record<string, string> = {
    positive: "text-emerald-400",
    negative: "text-red-400",
    neutral: "text-amber-400",
  };
  const sentimentLabel: Record<string, string> = {
    positive: "正面",
    negative: "负面",
    neutral: "中性",
  };

  const href = `/projects/${slug}/posts/${post.note_id ?? "unknown"}`;

  return (
    <Link
      href={href}
      style={{ textDecoration: "none", display: "block" }}
      className="rounded-xl border p-4 transition-colors hover:border-aurora-teal/40"
      style={{ borderColor: "var(--border)", background: "var(--surface2)" }}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <p className="text-sm font-medium line-clamp-1" style={{ color: "var(--text)" }}>
          {post.title || a?.summary || "（无标题）"}
        </p>
        {a?.sentiment && (
          <span
            className={`text-xs shrink-0 font-medium ${sentimentStyle[a.sentiment] ?? ""}`}
          >
            {sentimentLabel[a.sentiment] ?? a.sentiment}
          </span>
        )}
      </div>

      {a?.summary && (
        <p className="text-xs mb-3 line-clamp-2" style={{ color: "var(--muted)" }}>
          {a.summary}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 mb-3">
        {a?.tags?.slice(0, 4).map((tag) => (
          <span
            key={tag}
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: "var(--border)", color: "var(--muted)" }}
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-4 text-xs" style={{ color: "var(--muted)" }}>
        <span>👍 {post.likes ?? 0}</span>
        <span>💬 {post.comments ?? 0}</span>
        <span>⭐ 评分 {a?.quality_score ?? "-"}</span>
        <span className="ml-auto" style={{ color: "#1a2e4a" }}>→</span>
      </div>
    </Link>
  );
}

// ── Page ─────────────────────────────────────────────────
export default function ProjectPage({ params }: { params: { slug: string } }) {
  const data = getProjectAnalysis(params.slug);
  if (!data) notFound();

  const { meta, aggregate_insights: agg, tag_frequency, sentiment_breakdown, posts } = data;
  const projectName = params.slug.replace(/^\d+_/, "").replace(/_/g, " ");

  // Sort posts by quality score descending
  const sortedPosts = [...posts]
    .filter((p) => !p.llm_analysis?.error)
    .sort((a, b) => (b.llm_analysis?.quality_score ?? 0) - (a.llm_analysis?.quality_score ?? 0));

  const successRate = meta.total_raw
    ? Math.round(((meta.total_analyzed - meta.errors) / meta.total_raw) * 100)
    : 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      {/* Header */}
      <header className="border-b sticky top-0 z-10 backdrop-blur-sm" style={{ borderColor: "var(--border)", background: "rgba(15,17,23,0.85)" }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-sm transition-colors hover:text-white" style={{ color: "var(--muted)" }}>
            ← 返回
          </Link>
          <span style={{ color: "var(--border)" }}>/</span>
          <span className="text-sm font-medium" style={{ color: "var(--text)" }}>
            {projectName}
          </span>
          <span className="ml-auto text-xs" style={{ color: "var(--muted)" }}>
            分析时间：{new Date(meta.processed_at).toLocaleString("zh-CN")} · 模型：{meta.model}
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Title + Summary */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text)" }}>
            {projectName}
          </h1>
          <p className="text-base mb-5" style={{ color: "var(--muted)" }}>
            {meta.goal_summary}
          </p>
          {agg?.executive_summary && (
            <div
              className="rounded-xl border-l-4 px-5 py-4"
              style={{
                borderLeftColor: "var(--accent)",
                background: "var(--surface)",
                borderColor: "var(--border)",
              }}
            >
              <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
                {agg.executive_summary}
              </p>
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <StatCard label="原始帖子数" value={meta.total_raw} />
          <StatCard label="成功分析" value={meta.total_analyzed - meta.errors} />
          <StatCard
            label="分析成功率"
            value={`${successRate}%`}
            accent={successRate >= 90 ? "var(--positive)" : "var(--neutral)"}
          />
          <StatCard
            label="正面情感占比"
            value={`${Math.round(
              (sentiment_breakdown.positive /
                Math.max(1, sentiment_breakdown.positive + sentiment_breakdown.negative + sentiment_breakdown.neutral)) *
                100
            )}%`}
            accent="var(--positive)"
          />
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          {/* Sentiment Pie */}
          <Card title="情感分布">
            <SentimentPie data={sentiment_breakdown} />
          </Card>

          {/* Price Sensitivity */}
          {agg?.price_sensitivity_distribution && (
            <Card title="价格敏感度分布">
              <PriceRadar data={agg.price_sensitivity_distribution} />
            </Card>
          )}

          {/* Tag Frequency */}
          {Object.keys(tag_frequency).length > 0 && (
            <Card title="高频标签 TOP 15">
              <TagFrequencyBar data={tag_frequency} />
            </Card>
          )}

          {/* Competitive Mentions */}
          {agg?.competitive_mentions && agg.competitive_mentions.length > 0 && (
            <Card title="竞品提及（颜色代表情感）">
              <CompetitiveBar data={agg.competitive_mentions} />
            </Card>
          )}
        </div>

        {/* Pain Points */}
        {agg?.top_pain_points && agg.top_pain_points.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <Card title="核心痛点 TOP 10">
              <PainPointsBar data={agg.top_pain_points} />
            </Card>

            <Card title="痛点列表（按严重程度）">
              <div className="space-y-3">
                {agg.top_pain_points.slice(0, 8).map((p, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <SeverityBadge severity={p.severity} />
                    <p className="text-sm flex-1" style={{ color: "var(--text)" }}>
                      {p.point}
                    </p>
                    <span className="text-xs shrink-0" style={{ color: "var(--muted)" }}>
                      ×{p.frequency}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Desires + Scenarios + Recommendations */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {agg?.top_desires && agg.top_desires.length > 0 && (
            <Card title="用户期望">
              <ul className="space-y-2">
                {agg.top_desires.slice(0, 8).map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text)" }}>
                    <span style={{ color: "var(--accent)" }}>✦</span>
                    <span>{d.desire}</span>
                    <span className="ml-auto text-xs shrink-0" style={{ color: "var(--muted)" }}>×{d.frequency}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {agg?.top_use_scenarios && agg.top_use_scenarios.length > 0 && (
            <Card title="使用场景">
              <ul className="space-y-2">
                {agg.top_use_scenarios.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text)" }}>
                    <span style={{ color: "#f59e0b" }}>◆</span>
                    {s}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {agg?.key_recommendations && agg.key_recommendations.length > 0 && (
            <Card title="产品建议">
              <ul className="space-y-2">
                {agg.key_recommendations.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: "var(--text)" }}>
                    <span
                      className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: "var(--accent)", color: "white" }}
                    >
                      {i + 1}
                    </span>
                    {r}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {/* AI Query Panel */}
        <div className="mb-10">
          <AiQueryPanel slug={params.slug} />
        </div>

        {/* Posts Feed */}
        <Card title={`帖子详情（共 ${sortedPosts.length} 条，按质量评分排序）`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedPosts.slice(0, 30).map((post, i) => (
              <PostCard key={post.note_id ?? i} post={post} slug={params.slug} />
            ))}
          </div>
          {sortedPosts.length > 30 && (
            <p className="mt-4 text-sm text-center" style={{ color: "var(--muted)" }}>
              仅展示前 30 条，共 {sortedPosts.length} 条数据
            </p>
          )}
        </Card>
      </main>
    </div>
  );
}
