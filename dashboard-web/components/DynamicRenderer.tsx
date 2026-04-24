"use client";

/**
 * DynamicRenderer — GenUI 动态组件调度引擎
 *
 * 接收大模型返回的 layout JSON 数组，根据 component 字段
 * 从组件注册表中分发渲染，无需刷新页面。
 *
 * 支持组件：
 *   StatCard · NumberRow · BarChart · CompareBar
 *   DonutChart · AreaChart · RadarChart · QuoteCards
 */

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  RadarChart as ReRadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const AuroraAreaChart  = dynamic(() => import("@/components/charts/AuroraAreaChart"),  { ssr: false });
const AuroraDonutChart = dynamic(() => import("@/components/charts/AuroraDonutChart"), { ssr: false });

// ── Aurora palette ────────────────────────────────────────────
const AURORA = [
  "#00c9a7", "#818cf8", "#f472b6", "#60a5fa",
  "#a78bfa", "#22d3ee", "#fbbf24", "#fb7185",
];

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "#00c9a7",
  negative: "#fb7185",
  neutral:  "#818cf8",
};

// ── Shared card wrapper ───────────────────────────────────────
function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background:   "#0c1525",
        border:       "1px solid #1a2e4a",
        borderRadius: 18,
        padding:      "22px 24px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardTitle({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p style={{ color: "#e0e8ff", fontSize: 14, fontWeight: 600, marginBottom: 18 }}>
      {text}
    </p>
  );
}

// ════════════════════════════════════════════════════════════════
// 1. StatCard
// ════════════════════════════════════════════════════════════════
function StatCard({
  label,
  value,
  sub,
  gradient = "linear-gradient(135deg,#00c9a7,#818cf8)",
}: {
  label: string;
  value: string | number;
  sub?: string;
  gradient?: string;
}) {
  return (
    <Card>
      <p style={{ color: "#4f6490", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
        {label}
      </p>
      <p
        style={{
          fontSize: 34,
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
      {sub && <p style={{ color: "#39527a", fontSize: 12 }}>{sub}</p>}
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════
// 2. NumberRow — a horizontal row of mini stat chips
// ════════════════════════════════════════════════════════════════
interface NumberItem { label: string; value: string | number; sub?: string; color?: string }

function NumberRow({ items }: { items: NumberItem[] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, 1fr)`,
        gap: 14,
      }}
    >
      {items.map((item, i) => {
        const color = item.color ?? AURORA[i % AURORA.length];
        return (
          <div
            key={i}
            style={{
              background:   `${color}0d`,
              border:       `1px solid ${color}25`,
              borderRadius: 14,
              padding:      "16px 18px",
              textAlign:    "center",
            }}
          >
            <p style={{ color, fontSize: 24, fontWeight: 800, lineHeight: 1.2, marginBottom: 4 }}>
              {item.value}
            </p>
            <p style={{ color: "#8ea3cb", fontSize: 12, marginBottom: item.sub ? 2 : 0 }}>
              {item.label}
            </p>
            {item.sub && <p style={{ color: "#39527a", fontSize: 11 }}>{item.sub}</p>}
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 3. BarChart — horizontal ranked bars
// ════════════════════════════════════════════════════════════════
interface BarItem { name: string; value: number; color?: string }

function BarChart({ data }: { data: BarItem[] }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
      {data.map((item, i) => {
        const color = item.color ?? AURORA[i % AURORA.length];
        const pct   = (item.value / max) * 100;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "#8ea3cb", fontSize: 12, width: 110, flexShrink: 0, textAlign: "right", lineHeight: 1.4 }}>
              {item.name}
            </span>
            <div style={{ flex: 1, height: 8, background: "rgba(26,46,74,0.9)", borderRadius: 4, overflow: "hidden" }}>
              <div
                style={{
                  width:      `${pct}%`,
                  height:     "100%",
                  background: `linear-gradient(90deg, ${color}bb, ${color})`,
                  borderRadius: 4,
                  transition: "width 0.7s cubic-bezier(0.16,1,0.3,1)",
                }}
              />
            </div>
            <span style={{ color: "#e0e8ff", fontSize: 12, fontWeight: 600, minWidth: 28, textAlign: "right" }}>
              {item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 4. CompareBar — two-column side-by-side comparison
// ════════════════════════════════════════════════════════════════
interface CompareGroup { label: string; color: string; data: BarItem[] }

function CompareBar({ groups }: { groups: CompareGroup[] }) {
  if (!groups || groups.length < 2) return null;

  // Collect all unique "name" keys and build unified rows
  const allNames = Array.from(
    new Set(groups.flatMap((g) => g.data.map((d) => d.name)))
  );
  const globalMax = Math.max(
    ...groups.flatMap((g) => g.data.map((d) => d.value)),
    1
  );

  const lookup = (group: CompareGroup, name: string) =>
    group.data.find((d) => d.name === name)?.value ?? 0;

  return (
    <div>
      {/* Legend */}
      <div style={{ display: "flex", gap: 20, marginBottom: 18 }}>
        {groups.map((g) => (
          <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ width: 14, height: 14, borderRadius: "50%", background: g.color, display: "inline-block" }} />
            <span style={{ color: "#8ea3cb", fontSize: 12 }}>{g.label}</span>
          </div>
        ))}
      </div>

      {/* Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {allNames.map((name) => (
          <div key={name}>
            <p style={{ color: "#6b82ab", fontSize: 11, marginBottom: 6 }}>{name}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {groups.map((g) => {
                const val = lookup(g, name);
                const pct = (val / globalMax) * 100;
                return (
                  <div key={g.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ color: g.color, fontSize: 10, width: 36, flexShrink: 0, textAlign: "right" }}>
                      {g.label}
                    </span>
                    <div style={{ flex: 1, height: 7, background: "rgba(26,46,74,0.9)", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          width:      `${pct}%`,
                          height:     "100%",
                          background: `linear-gradient(90deg, ${g.color}99, ${g.color})`,
                          borderRadius: 4,
                          transition: "width 0.7s cubic-bezier(0.16,1,0.3,1)",
                        }}
                      />
                    </div>
                    <span style={{ color: "#e0e8ff", fontSize: 11, fontWeight: 600, minWidth: 22, textAlign: "right" }}>
                      {val || "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 5. RadarChart
// ════════════════════════════════════════════════════════════════
interface RadarItem { subject: string; value: number }

function AuroraRadar({ data }: { data: RadarItem[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ReRadarChart data={data} margin={{ top: 8, right: 16, left: 16, bottom: 8 }}>
        <PolarGrid stroke="#1a2e4a" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fill: "#6b82ab", fontSize: 12 }}
        />
        <Radar
          dataKey="value"
          stroke="#818cf8"
          fill="#818cf8"
          fillOpacity={0.25}
          strokeWidth={2}
        />
        <Tooltip
          contentStyle={{
            background:   "rgba(11,21,38,0.94)",
            border:       "1px solid rgba(129,140,248,0.25)",
            borderRadius: 10,
          }}
          itemStyle={{ color: "#818cf8" }}
          labelStyle={{ color: "#e0e8ff" }}
        />
      </ReRadarChart>
    </ResponsiveContainer>
  );
}

// ════════════════════════════════════════════════════════════════
// 6. QuoteCards — inline masonry (no mock-data dep)
// ════════════════════════════════════════════════════════════════
interface QuoteItem {
  id?:          string | number;
  title?:       string;
  content:      string;
  sentiment?:   string;
  tags?:        string[];
  pain_points?: string[];
  author?:      string;
  likes?:       number;
  collects?:    number;
  comments?:    number;
  platform?:    string;
}

const BORDER_GRADS = [
  "linear-gradient(135deg,rgba(0,201,167,.55),rgba(129,140,248,.45))",
  "linear-gradient(135deg,rgba(129,140,248,.55),rgba(244,114,182,.45))",
  "linear-gradient(135deg,rgba(34,211,238,.50),rgba(0,201,167,.40))",
  "linear-gradient(135deg,rgba(251,113,133,.45),rgba(167,139,250,.50))",
];

function QuoteCard({ q, idx }: { q: QuoteItem; idx: number }) {
  const sentColor = SENTIMENT_COLOR[q.sentiment ?? "neutral"] ?? "#818cf8";
  const border    = BORDER_GRADS[idx % BORDER_GRADS.length];
  const sentLabel: Record<string, string> = { positive: "正面", negative: "负面", neutral: "中性" };

  return (
    <div style={{ background: border, padding: 1, borderRadius: 18, marginBottom: 14, breakInside: "avoid" }}>
      <div style={{ background: "#0c1525", borderRadius: 17, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{
            padding: "3px 10px", borderRadius: 20,
            background: `${sentColor}18`, color: sentColor, fontSize: 11, fontWeight: 600,
          }}>
            {sentLabel[q.sentiment ?? "neutral"] ?? q.sentiment ?? "—"}
          </span>
          <span style={{ color: "#39527a", fontSize: 11 }}>{q.platform}</span>
        </div>
        {q.title && (
          <p style={{ color: "#b4c6ef", fontSize: 13, fontWeight: 600, marginBottom: 8, lineHeight: 1.45 }}>
            {q.title}
          </p>
        )}
        <p style={{ color: "#8ea3cb", fontSize: 13, lineHeight: 1.75, marginBottom: 10 }}>
          {q.content}
        </p>
        {q.pain_points && q.pain_points.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
            {q.pain_points.map((pt) => (
              <span key={pt} style={{
                padding: "2px 8px", borderRadius: 20,
                background: "rgba(251,113,133,.10)", border: "1px solid rgba(251,113,133,.20)",
                color: "#fb7185", fontSize: 11,
              }}>
                ⚡ {pt}
              </span>
            ))}
          </div>
        )}
        {q.tags && q.tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 10 }}>
            {q.tags.slice(0, 4).map((t) => (
              <span key={t} style={{
                padding: "2px 8px", borderRadius: 20,
                background: "rgba(26,46,74,.8)", color: "#6b82ab", fontSize: 11,
              }}>
                # {t}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid rgba(26,46,74,.8)", paddingTop: 10 }}>
          <span style={{ color: "#6b82ab", fontSize: 12 }}>{q.author}</span>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { icon: "♥", v: q.likes,    c: "#fb7185" },
              { icon: "★", v: q.collects, c: "#fbbf24" },
              { icon: "✦", v: q.comments, c: "#818cf8" },
            ].map(({ icon, v, c }) => v != null && (
              <span key={icon} style={{ color: "#39527a", fontSize: 12, display: "flex", gap: 3, alignItems: "center" }}>
                <span style={{ color: c }}>{icon}</span>
                {(v ?? 0) >= 1000 ? `${((v ?? 0) / 1000).toFixed(1)}k` : (v ?? 0)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function QuoteCards({ quotes }: { quotes: QuoteItem[] }) {
  return (
    <div style={{ columnCount: 3, columnGap: 14 }}>
      {quotes.map((q, i) => (
        <QuoteCard key={q.id ?? i} q={q} idx={i} />
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Component registry — maps component name → renderer fn
// ════════════════════════════════════════════════════════════════
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Spec = Record<string, any>;

function renderOne(spec: Spec, idx: number): React.ReactNode {
  const { component, title, span: _span, ...rest } = spec;

  return (
    <Card key={idx}>
      <CardTitle text={title} />
      {(() => {
        switch (component as string) {
          case "StatCard":
            return (
              <StatCard
                label={rest.label ?? ""}
                value={rest.value ?? ""}
                sub={rest.sub}
                gradient={rest.gradient}
              />
            );

          case "NumberRow":
            return <NumberRow items={rest.items ?? []} />;

          case "BarChart":
            return <BarChart data={rest.data ?? []} />;

          case "CompareBar":
            return <CompareBar groups={rest.groups ?? []} />;

          case "DonutChart":
            return (
              <AuroraDonutChart
                data={rest.data ?? []}
                centerLabel={rest.centerLabel}
                centerSub={rest.centerSub}
                showLegend={rest.showLegend ?? true}
              />
            );

          case "AreaChart":
            return (
              <AuroraAreaChart
                data={rest.data ?? []}
                lines={rest.lines ?? []}
                xKey={rest.xKey ?? "week"}
                height={rest.height ?? 260}
              />
            );

          case "RadarChart":
            return <AuroraRadar data={rest.data ?? []} />;

          case "QuoteCards":
            return <QuoteCards quotes={rest.quotes ?? []} />;

          default:
            return (
              <p style={{ color: "#4f6490", fontSize: 12 }}>
                未知组件：{component}
              </p>
            );
        }
      })()}
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════
// Animated wrapper — stagger fade-in per card
// ════════════════════════════════════════════════════════════════
function AnimatedCard({
  children,
  delay,
}: {
  children: React.ReactNode;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div
      ref={ref}
      style={{
        opacity:   visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(20px)",
        transition:"opacity 0.45s ease, transform 0.45s cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {children}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Grid layout — span="full" takes entire row, span="half" pairs up
// ════════════════════════════════════════════════════════════════

// Force full-width for these component types regardless of `span`
const ALWAYS_FULL = new Set(["QuoteCards", "CompareBar", "AreaChart", "NumberRow"]);

function resolveSpan(spec: Spec): "full" | "half" {
  if (ALWAYS_FULL.has(spec.component)) return "full";
  return spec.span === "full" ? "full" : "half";
}

// ════════════════════════════════════════════════════════════════
// Public API
// ════════════════════════════════════════════════════════════════
export interface LayoutItem {
  component: string;
  span?:     "half" | "full";
  title?:    string;
  [key: string]: unknown;
}

export interface DashboardLayout {
  answer:  string;
  layout:  LayoutItem[];
  // backward-compat alias used by AiQueryPanel
  components?: LayoutItem[];
}

export default function DynamicRenderer({ plan }: { plan: DashboardLayout }) {
  // Normalise: accept both "layout" and legacy "components" key
  const items: LayoutItem[] = plan.layout?.length
    ? plan.layout
    : (plan.components ?? []);

  return (
    <div>
      {/* Answer summary */}
      {plan.answer && (
        <div
          style={{
            borderLeft:      "3px solid #00c9a7",
            background:      "#0c1525",
            border:          "1px solid #1a2e4a",
            borderLeftColor: "#00c9a7",
            borderLeftWidth: 3,
            borderRadius:    12,
            padding:         "14px 18px",
            marginBottom:    24,
          }}
        >
          <p style={{ color: "#b4c6ef", fontSize: 14, lineHeight: 1.75 }}>
            {plan.answer}
          </p>
        </div>
      )}

      {/* Component grid */}
      <div
        style={{
          display:             "grid",
          gridTemplateColumns: "1fr 1fr",
          gap:                 16,
        }}
      >
        {items.map((spec, i) => {
          const span = resolveSpan(spec);
          return (
            <AnimatedCard key={i} delay={i * 80}>
              <div style={{ gridColumn: span === "full" ? "1 / -1" : undefined }}>
                {renderOne(spec, i)}
              </div>
            </AnimatedCard>
          );
        })}
      </div>
    </div>
  );
}
