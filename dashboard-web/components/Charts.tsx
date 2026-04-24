"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
} from "recharts";

// Aurora gradient palette — no high-saturation flat colors
const COLORS = ["#00c9a7", "#818cf8", "#f472b6", "#60a5fa", "#a78bfa", "#22d3ee", "#fbbf24", "#fb7185"];

// ── Sentiment Pie ──────────────────────────────────────────
interface SentimentPieProps {
  data: { positive: number; negative: number; neutral: number };
}
export function SentimentPie({ data }: SentimentPieProps) {
  const chartData = [
    { name: "正面", value: data.positive, color: "#00c9a7" },
    { name: "负面", value: data.negative, color: "#fb7185" },
    { name: "中性", value: data.neutral,  color: "#818cf8" },
  ].filter((d) => d.value > 0);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="45%"
          innerRadius={60}
          outerRadius={90}
          paddingAngle={3}
          dataKey="value"
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Pie>
        <Legend
          formatter={(value) => (
            <span style={{ color: "#94a3b8", fontSize: 12 }}>{value}</span>
          )}
        />
        <Tooltip
          contentStyle={{ background: "#1a1d27", border: "1px solid #2e3350", borderRadius: 8 }}
          labelStyle={{ color: "#e2e8f0" }}
          itemStyle={{ color: "#94a3b8" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Tag Frequency Bar ──────────────────────────────────────
interface TagBarProps {
  data: Record<string, number>;
  maxItems?: number;
}
export function TagFrequencyBar({ data, maxItems = 15 }: TagBarProps) {
  const chartData = Object.entries(data)
    .slice(0, maxItems)
    .map(([tag, count]) => ({ tag, count }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 24 }}>
        <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="tag"
          tick={{ fill: "#94a3b8", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={80}
        />
        <Tooltip
          contentStyle={{ background: "#1a1d27", border: "1px solid #2e3350", borderRadius: 8 }}
          itemStyle={{ color: "#6366f1" }}
          labelStyle={{ color: "#e2e8f0" }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Pain Points Bar ──────────────────────────────────────
interface PainPointsBarProps {
  data: { point: string; frequency: number; severity: string }[];
}
export function PainPointsBar({ data }: PainPointsBarProps) {
  const severityColor: Record<string, string> = {
    high:   "#fb7185",
    medium: "#fbbf24",
    low:    "#00c9a7",
  };
  const chartData = data.slice(0, 10).map((d) => ({
    name: d.point.length > 20 ? d.point.slice(0, 20) + "…" : d.point,
    full: d.point,
    count: d.frequency,
    color: severityColor[d.severity] ?? "#6366f1",
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 16, right: 24 }}>
        <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "#94a3b8", fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={120}
        />
        <Tooltip
          contentStyle={{ background: "#1a1d27", border: "1px solid #2e3350", borderRadius: 8 }}
          itemStyle={{ color: "#ef4444" }}
          labelStyle={{ color: "#e2e8f0" }}
          formatter={(_v, _n, props) => [props.payload.count, props.payload.full]}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Competitive Mentions Bar ──────────────────────────────
interface CompetitiveBarProps {
  data: { brand: string; sentiment: string; count: number }[];
}
export function CompetitiveBar({ data }: CompetitiveBarProps) {
  const sentColor: Record<string, string> = {
    positive: "#00c9a7",
    negative: "#fb7185",
    neutral:  "#818cf8",
  };
  const chartData = data.slice(0, 10).map((d) => ({
    brand: d.brand,
    count: d.count,
    fill: sentColor[d.sentiment] ?? "#6366f1",
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ bottom: 8 }}>
        <XAxis dataKey="brand" tick={{ fill: "#94a3b8", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#1a1d27", border: "1px solid #2e3350", borderRadius: 8 }}
          itemStyle={{ color: "#6366f1" }}
          labelStyle={{ color: "#e2e8f0" }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Price Sensitivity Radar ──────────────────────────────
interface PriceRadarProps {
  data: Record<string, number>;
}
export function PriceRadar({ data }: PriceRadarProps) {
  const labelMap: Record<string, string> = {
    high: "高敏感",
    medium: "中等",
    low: "低敏感",
    unknown: "未知",
  };
  const chartData = Object.entries(data).map(([k, v]) => ({
    subject: labelMap[k] ?? k,
    value: v,
  }));

  return (
    <ResponsiveContainer width="100%" height={240}>
      <RadarChart data={chartData}>
        <PolarGrid stroke="#2e3350" />
        <PolarAngleAxis dataKey="subject" tick={{ fill: "#94a3b8", fontSize: 12 }} />
        <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.3} />
        <Tooltip
          contentStyle={{ background: "#1a1d27", border: "1px solid #2e3350", borderRadius: 8 }}
          itemStyle={{ color: "#6366f1" }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
