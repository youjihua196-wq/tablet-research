"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ── Aurora gradient definitions (injected into SVG <defs>) ────
const GRADIENTS = [
  { id: "grad-teal",   color: "#00c9a7" },
  { id: "grad-rose",   color: "#fb7185" },
  { id: "grad-violet", color: "#818cf8" },
  { id: "grad-blue",   color: "#60a5fa" },
];

// ── Custom Tooltip ────────────────────────────────────────────
interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

function AuroraTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(11, 21, 38, 0.92)",
        border: "1px solid rgba(0,201,167,0.25)",
        borderRadius: "12px",
        padding: "12px 16px",
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        minWidth: 140,
      }}
    >
      <p
        style={{ color: "#6b82ab", fontSize: "11px", marginBottom: "8px", letterSpacing: "0.05em" }}
      >
        {label}
      </p>
      {payload.map((entry) => (
        <div
          key={entry.name}
          style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: entry.color,
              flexShrink: 0,
            }}
          />
          <span style={{ color: "#b4c6ef", fontSize: "12px" }}>{entry.name}</span>
          <span style={{ color: "#e0e8ff", fontSize: "13px", fontWeight: 600, marginLeft: "auto" }}>
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Custom Legend ─────────────────────────────────────────────
function AuroraLegend({ payload }: { payload?: { value: string; color: string }[] }) {
  if (!payload?.length) return null;
  return (
    <div style={{ display: "flex", gap: "20px", justifyContent: "center", marginTop: "12px" }}>
      {payload.map((entry) => (
        <div key={entry.value} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: 20,
              height: 3,
              borderRadius: 2,
              background: entry.color,
              display: "inline-block",
            }}
          />
          <span style={{ color: "#6b82ab", fontSize: "12px" }}>{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────
export interface AreaLine {
  key:   string;
  label: string;
  color: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AuroraAreaChartProps {
  data:       any[];
  lines:      AreaLine[];
  xKey?:      string;
  title?:     string;
  subtitle?:  string;
  height?:    number;
}

// ── Component ─────────────────────────────────────────────────
export default function AuroraAreaChart({
  data,
  lines,
  xKey     = "week",
  title,
  subtitle,
  height   = 280,
}: AuroraAreaChartProps) {
  return (
    <div>
      {(title || subtitle) && (
        <div style={{ marginBottom: 20 }}>
          {title && (
            <p style={{ color: "#e0e8ff", fontSize: "15px", fontWeight: 600, marginBottom: 4 }}>
              {title}
            </p>
          )}
          {subtitle && (
            <p style={{ color: "#6b82ab", fontSize: "12px" }}>{subtitle}</p>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          {/* SVG gradient definitions */}
          <defs>
            {GRADIENTS.map(({ id, color }) => (
              <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
                <stop offset="75%" stopColor={color} stopOpacity={0.04} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(26,46,74,0.8)"
            vertical={false}
          />

          <XAxis
            dataKey={xKey}
            tick={{ fill: "#6b82ab", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            dy={8}
          />
          <YAxis
            tick={{ fill: "#6b82ab", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip content={<AuroraTooltip />} />

          <Legend content={<AuroraLegend />} />

          {lines.map(({ key, label, color }, idx) => {
            const gradId = GRADIENTS[idx % GRADIENTS.length]?.id ?? "grad-teal";
            return (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={label}
                stroke={color}
                strokeWidth={2}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
