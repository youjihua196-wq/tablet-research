"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

// ── Aurora default color cycle ────────────────────────────────
const AURORA_CYCLE = [
  "#00c9a7",  // teal
  "#60a5fa",  // blue
  "#a78bfa",  // purple
  "#f472b6",  // rose
  "#22d3ee",  // cyan
  "#fbbf24",  // amber
  "#818cf8",  // violet
  "#fb7185",  // pink
];

// ── Tooltip ───────────────────────────────────────────────────
function DonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { color?: string; pct?: string } }[];
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div
      style={{
        background: "rgba(11, 21, 38, 0.94)",
        border: "1px solid rgba(0,201,167,0.2)",
        borderRadius: "10px",
        padding: "10px 14px",
        backdropFilter: "blur(10px)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      <span style={{ color: "#e0e8ff", fontSize: "13px", fontWeight: 600 }}>
        {entry.name}
      </span>
      <span style={{ color: "#6b82ab", fontSize: "13px" }}>
        &nbsp;· {entry.value} 次
      </span>
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────
export interface DonutItem {
  name:   string;
  value:  number;
  color?: string;
}

export interface AuroraDonutChartProps {
  data:          DonutItem[];
  title?:        string;
  subtitle?:     string;
  centerLabel?:  string;   // text shown in the hole
  centerSub?:    string;
  size?:         number;   // outer radius px
  innerRatio?:   number;   // inner / outer (0–1), default 0.65
  showLegend?:   boolean;
}

// ── Component ─────────────────────────────────────────────────
export default function AuroraDonutChart({
  data,
  title,
  subtitle,
  centerLabel,
  centerSub,
  size       = 100,
  innerRatio = 0.65,
  showLegend = true,
}: AuroraDonutChartProps) {
  const innerR = Math.round(size * innerRatio);
  const total  = data.reduce((s, d) => s + d.value, 0);

  return (
    <div>
      {(title || subtitle) && (
        <div style={{ marginBottom: 16 }}>
          {title && (
            <p style={{ color: "#e0e8ff", fontSize: "15px", fontWeight: 600, marginBottom: 4 }}>
              {title}
            </p>
          )}
          {subtitle && <p style={{ color: "#6b82ab", fontSize: "12px" }}>{subtitle}</p>}
        </div>
      )}

      {/* Chart + center label */}
      <div style={{ position: "relative" }}>
        <ResponsiveContainer width="100%" height={size * 2 + 20}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={size}
              innerRadius={innerR}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell
                  key={`cell-${i}`}
                  fill={entry.color ?? AURORA_CYCLE[i % AURORA_CYCLE.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<DonutTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label overlay */}
        {(centerLabel || centerSub) && (
          <div
            style={{
              position:  "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              textAlign: "center",
              pointerEvents: "none",
            }}
          >
            {centerLabel && (
              <p
                style={{
                  fontSize:   "22px",
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #00c9a7, #818cf8)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  lineHeight: 1.2,
                }}
              >
                {centerLabel}
              </p>
            )}
            {centerSub && (
              <p style={{ color: "#6b82ab", fontSize: "11px", marginTop: "4px" }}>
                {centerSub}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginTop: "16px",
          }}
        >
          {data.map((entry, i) => {
            const color = entry.color ?? AURORA_CYCLE[i % AURORA_CYCLE.length];
            const pct   = total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
            return (
              <div
                key={entry.name}
                style={{ display: "flex", alignItems: "center", gap: "10px" }}
              >
                {/* Color dot */}
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: color,
                    flexShrink: 0,
                    boxShadow: `0 0 8px ${color}60`,
                  }}
                />
                {/* Label */}
                <span style={{ color: "#8ea3cb", fontSize: "12px", flex: 1 }}>
                  {entry.name}
                </span>
                {/* Percentage bar */}
                <div
                  style={{
                    width: 60,
                    height: 4,
                    background: "rgba(26,46,74,0.8)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width:        `${pct}%`,
                      height:       "100%",
                      background:   color,
                      borderRadius: 2,
                      transition:   "width 0.6s ease",
                    }}
                  />
                </div>
                {/* Value */}
                <span style={{ color: "#e0e8ff", fontSize: "12px", fontWeight: 600, minWidth: 32, textAlign: "right" }}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
