"use client";

import type { UserQuote } from "@/lib/mock-data";

// ── Aurora gradient border presets (cycles per card) ─────────
const BORDER_GRADIENTS = [
  "linear-gradient(135deg, rgba(0,201,167,0.55), rgba(129,140,248,0.45))",
  "linear-gradient(135deg, rgba(129,140,248,0.55), rgba(244,114,182,0.45))",
  "linear-gradient(135deg, rgba(34,211,238,0.50), rgba(0,201,167,0.40))",
  "linear-gradient(135deg, rgba(251,113,133,0.45), rgba(167,139,250,0.50))",
];

// ── Sentiment config ──────────────────────────────────────────
const SENTIMENT_MAP = {
  positive: { label: "正面", color: "#00c9a7", bg: "rgba(0,201,167,0.12)", glyph: "↑" },
  negative: { label: "负面", color: "#fb7185", bg: "rgba(251,113,133,0.12)", glyph: "↓" },
  neutral:  { label: "中性", color: "#818cf8", bg: "rgba(129,140,248,0.12)", glyph: "→" },
};

// ── Single Card ───────────────────────────────────────────────
function QuoteCard({ quote, index }: { quote: UserQuote; index: number }) {
  const sentiment = SENTIMENT_MAP[quote.sentiment] ?? SENTIMENT_MAP.neutral;
  const borderGrad = BORDER_GRADIENTS[index % BORDER_GRADIENTS.length];

  return (
    /* Gradient border wrapper */
    <div
      style={{
        background:   borderGrad,
        padding:      "1px",
        borderRadius: "18px",
        marginBottom: "16px",
        breakInside:  "avoid",
      }}
    >
      {/* Card inner */}
      <div
        style={{
          background:   "#0c1525",
          borderRadius: "17px",
          padding:      "20px",
          display:      "flex",
          flexDirection:"column",
          gap:          "14px",
          transition:   "background 0.2s",
        }}
      >
        {/* Header: sentiment badge + platform */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span
            style={{
              display:      "inline-flex",
              alignItems:   "center",
              gap:          "5px",
              padding:      "3px 10px",
              borderRadius: "20px",
              background:   sentiment.bg,
              color:        sentiment.color,
              fontSize:     "11px",
              fontWeight:   600,
              letterSpacing: "0.03em",
            }}
          >
            <span>{sentiment.glyph}</span>
            {sentiment.label}
          </span>
          <span style={{ color: "#39527a", fontSize: "11px" }}>{quote.platform}</span>
        </div>

        {/* Title */}
        {quote.title && (
          <p style={{ color: "#b4c6ef", fontSize: "13px", fontWeight: 600, lineHeight: 1.5 }}>
            {quote.title}
          </p>
        )}

        {/* Quote text — opening mark */}
        <div style={{ position: "relative" }}>
          <span
            style={{
              position:   "absolute",
              top:        "-6px",
              left:       "-4px",
              fontSize:   "36px",
              lineHeight: 1,
              color:      "rgba(129,140,248,0.18)",
              fontFamily: "Georgia, serif",
              userSelect: "none",
            }}
          >
            "
          </span>
          <p
            style={{
              color:      "#8ea3cb",
              fontSize:   "13px",
              lineHeight: 1.75,
              paddingLeft: "12px",
              paddingTop:  "4px",
            }}
          >
            {quote.content}
          </p>
        </div>

        {/* Pain point tags */}
        {quote.pain_points.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {quote.pain_points.map((pt) => (
              <span
                key={pt}
                style={{
                  padding:      "2px 9px",
                  borderRadius: "20px",
                  background:   "rgba(251,113,133,0.10)",
                  border:       "1px solid rgba(251,113,133,0.20)",
                  color:        "#fb7185",
                  fontSize:     "11px",
                }}
              >
                ⚡ {pt}
              </span>
            ))}
          </div>
        )}

        {/* Topic tags */}
        {quote.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
            {quote.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                style={{
                  padding:      "2px 8px",
                  borderRadius: "20px",
                  background:   "rgba(26,46,74,0.8)",
                  color:        "#6b82ab",
                  fontSize:     "11px",
                }}
              >
                # {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer: author + engagement */}
        <div
          style={{
            display:        "flex",
            alignItems:     "center",
            justifyContent: "space-between",
            borderTop:      "1px solid rgba(26,46,74,0.8)",
            paddingTop:     "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Avatar placeholder */}
            <div
              style={{
                width:       28,
                height:      28,
                borderRadius:"50%",
                background:  borderGrad,
                display:     "flex",
                alignItems:  "center",
                justifyContent: "center",
                fontSize:    "12px",
                color:       "#e0e8ff",
                fontWeight:  600,
                flexShrink:  0,
              }}
            >
              {quote.author.slice(0, 1)}
            </div>
            <span style={{ color: "#6b82ab", fontSize: "12px" }}>{quote.author}</span>
          </div>

          <div style={{ display: "flex", gap: "14px" }}>
            {[
              { icon: "♥", val: quote.likes,    color: "#fb7185" },
              { icon: "★", val: quote.collects, color: "#fbbf24" },
              { icon: "✦", val: quote.comments, color: "#818cf8" },
            ].map(({ icon, val, color }) => (
              <span
                key={icon}
                style={{ color: "#39527a", fontSize: "12px", display: "flex", gap: "4px", alignItems: "center" }}
              >
                <span style={{ color }}>{icon}</span>
                {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Masonry Grid ──────────────────────────────────────────────
export interface AuroraMasonryCardsProps {
  quotes:    UserQuote[];
  columns?:  2 | 3 | 4;
  title?:    string;
  subtitle?: string;
}

export default function AuroraMasonryCards({
  quotes,
  columns  = 3,
  title,
  subtitle,
}: AuroraMasonryCardsProps) {
  const columnStyle: React.CSSProperties = {
    columnCount: columns,
    columnGap:   "16px",
  };

  return (
    <div>
      {(title || subtitle) && (
        <div style={{ marginBottom: 24 }}>
          {title && (
            <p style={{ color: "#e0e8ff", fontSize: "15px", fontWeight: 600, marginBottom: 4 }}>
              {title}
            </p>
          )}
          {subtitle && <p style={{ color: "#6b82ab", fontSize: "12px" }}>{subtitle}</p>}
        </div>
      )}

      {/* CSS columns masonry */}
      <div style={columnStyle}>
        {quotes.map((q, i) => (
          <QuoteCard key={q.id} quote={q} index={i} />
        ))}
      </div>
    </div>
  );
}
