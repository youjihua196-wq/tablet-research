import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectAnalysis } from "@/lib/data";

export const dynamic = "force-dynamic";

// ── Sentiment helpers ─────────────────────────────────────────
const SENTIMENT_MAP: Record<string, { label: string; color: string; bg: string }> = {
  positive: { label: "正面", color: "#00c9a7", bg: "rgba(0,201,167,0.12)" },
  negative: { label: "负面", color: "#fb7185", bg: "rgba(251,113,133,0.12)" },
  neutral:  { label: "中性", color: "#818cf8", bg: "rgba(129,140,248,0.12)" },
};

// ── Tag chip ──────────────────────────────────────────────────
function Tag({ text, color = "#6b82ab" }: { text: string; color?: string }) {
  return (
    <span
      style={{
        padding:      "3px 10px",
        borderRadius: "20px",
        background:   `${color}18`,
        border:       `1px solid ${color}30`,
        color,
        fontSize:     "12px",
      }}
    >
      {text}
    </span>
  );
}

// ── Section ───────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background:   "#0c1525",
        border:       "1px solid #1a2e4a",
        borderRadius: "16px",
        padding:      "20px 24px",
      }}
    >
      <p
        style={{
          color:        "#4f6490",
          fontSize:     "11px",
          letterSpacing:"0.08em",
          textTransform:"uppercase",
          marginBottom: "14px",
        }}
      >
        {title}
      </p>
      {children}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────
export default function PostDetailPage({
  params,
}: {
  params: { slug: string; id: string };
}) {
  const analysis = getProjectAnalysis(params.slug);
  if (!analysis) notFound();

  const post = analysis.posts.find(
    (p) => p.note_id === params.id || String(p.note_id) === params.id
  );
  if (!post) notFound();

  const a         = post.llm_analysis ?? {};
  const sentiment = SENTIMENT_MAP[a.sentiment ?? "neutral"] ?? SENTIMENT_MAP.neutral;
  const projectName = params.slug.replace(/^\d+_/, "").replace(/_/g, " ");

  return (
    <div style={{ minHeight: "100vh", background: "#060b18" }}>
      {/* ── Header ──────────────────────────────────────────── */}
      <header
        style={{
          borderBottom:   "1px solid #1a2e4a",
          background:     "rgba(6,11,24,0.85)",
          backdropFilter: "blur(16px)",
          position:       "sticky",
          top:            0,
          zIndex:         50,
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin:   "0 auto",
            padding:  "0 32px",
            height:   60,
            display:  "flex",
            alignItems:"center",
            gap:      12,
          }}
        >
          <Link
            href={`/projects/${params.slug}`}
            style={{ color: "#4f6490", fontSize: 13, textDecoration: "none" }}
          >
            ← {projectName}
          </Link>
          <span style={{ color: "#1a2e4a" }}>/</span>
          <span style={{ color: "#8ea3cb", fontSize: 13 }}>
            {post.title?.slice(0, 40) ?? "帖子详情"}
          </span>
        </div>
      </header>

      {/* ── Body ─────────────────────────────────────────────── */}
      <main
        style={{
          maxWidth: 900,
          margin:   "0 auto",
          padding:  "48px 32px 80px",
          display:  "flex",
          flexDirection: "column",
          gap:      "20px",
        }}
      >
        {/* Title + Sentiment */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span
              style={{
                padding:      "4px 12px",
                borderRadius: "20px",
                background:   sentiment.bg,
                color:        sentiment.color,
                fontSize:     12,
                fontWeight:   600,
              }}
            >
              {sentiment.label}
            </span>
            {post.platform && (
              <span style={{ color: "#39527a", fontSize: 12 }}>{post.platform}</span>
            )}
            {post.created_at && (
              <span style={{ color: "#39527a", fontSize: 12, marginLeft: "auto" }}>
                {post.created_at}
              </span>
            )}
          </div>
          <h1
            style={{
              fontSize:   "26px",
              fontWeight: 800,
              background: "linear-gradient(90deg, #e0e8ff, #818cf8)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor:  "transparent",
              backgroundClip: "text",
              lineHeight:   1.35,
            }}
          >
            {post.title ?? "（无标题）"}
          </h1>
        </div>

        {/* Original content */}
        {post.content && (
          <Section title="原文内容">
            <p style={{ color: "#b4c6ef", fontSize: 14, lineHeight: 1.85 }}>
              {post.content}
            </p>
          </Section>
        )}

        {/* LLM Summary */}
        {a.summary && (
          <Section title="AI 摘要">
            <p style={{ color: "#8ea3cb", fontSize: 14, lineHeight: 1.8 }}>
              {a.summary}
            </p>
            {a.sentiment_reason && (
              <p
                style={{
                  marginTop:  12,
                  padding:    "8px 12px",
                  borderRadius: 8,
                  background: `${sentiment.color}0d`,
                  color:      sentiment.color,
                  fontSize:   13,
                  lineHeight: 1.6,
                }}
              >
                情感判断依据：{a.sentiment_reason}
              </p>
            )}
          </Section>
        )}

        {/* Tags + Pain points + Desires */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {a.tags && a.tags.length > 0 && (
            <Section title="话题标签">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {a.tags.map((t) => (
                  <Tag key={t} text={`# ${t}`} color="#818cf8" />
                ))}
              </div>
            </Section>
          )}

          {a.pain_points && a.pain_points.length > 0 && (
            <Section title="提及痛点">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {a.pain_points.map((p) => (
                  <Tag key={p} text={`⚡ ${p}`} color="#fb7185" />
                ))}
              </div>
            </Section>
          )}

          {a.desires && a.desires.length > 0 && (
            <Section title="用户期望">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {a.desires.map((d) => (
                  <Tag key={d} text={`✦ ${d}`} color="#00c9a7" />
                ))}
              </div>
            </Section>
          )}

          {a.mentioned_products && a.mentioned_products.length > 0 && (
            <Section title="提及产品">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {a.mentioned_products.map((p) => (
                  <Tag key={p} text={p} color="#60a5fa" />
                ))}
              </div>
            </Section>
          )}
        </div>

        {/* Engagement metrics */}
        <Section title="互动数据">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
            }}
          >
            {[
              { label: "点赞",   value: post.likes,     color: "#fb7185", icon: "♥" },
              { label: "收藏",   value: post.collects,  color: "#fbbf24", icon: "★" },
              { label: "评论",   value: post.comments,  color: "#818cf8", icon: "✦" },
              { label: "质量评分", value: a.quality_score ?? "—", color: "#00c9a7", icon: "◎" },
            ].map(({ label, value, color, icon }) => (
              <div
                key={label}
                style={{
                  textAlign:    "center",
                  padding:      "14px 0",
                  background:   `${color}0d`,
                  borderRadius: 12,
                  border:       `1px solid ${color}20`,
                }}
              >
                <p style={{ color, fontSize: 20, marginBottom: 4 }}>{icon}</p>
                <p style={{ color: "#e0e8ff", fontSize: 18, fontWeight: 700 }}>{value}</p>
                <p style={{ color: "#4f6490", fontSize: 11 }}>{label}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Author */}
        {post.author && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width:        36,
                height:       36,
                borderRadius: "50%",
                background:   "linear-gradient(135deg, #00c9a7, #818cf8)",
                display:      "flex",
                alignItems:   "center",
                justifyContent: "center",
                color:        "#060b18",
                fontWeight:   700,
                fontSize:     14,
              }}
            >
              {post.author.slice(0, 1)}
            </div>
            <span style={{ color: "#6b82ab", fontSize: 13 }}>{post.author}</span>
          </div>
        )}
      </main>
    </div>
  );
}
