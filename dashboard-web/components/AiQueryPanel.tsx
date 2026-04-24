"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { RenderPlan } from "@/components/DynamicRenderer";

const DynamicRenderer = dynamic(
  () => import("@/components/DynamicRenderer"),
  { ssr: false }
);

const SUGGESTED = [
  "哪些痛点出现最频繁？用图表展示",
  "正负面情感各有哪些典型帖子？",
  "各竞品的情感对比如何？",
  "价格敏感度分布是怎样的？",
];

export default function AiQueryPanel({ slug }: { slug: string }) {
  const [query, setQuery]     = useState("");
  const [plan, setPlan]       = useState<RenderPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(q?: string) {
    const text = (q ?? query).trim();
    if (!text) return;
    if (q) setQuery(q);
    setLoading(true);
    setError("");
    setPlan(null);
    try {
      const res = await fetch("/api/ai/render", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ query: text, slug }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RenderPlan;
      setPlan(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background:   "#0c1525",
        border:       "1px solid #1a2e4a",
        borderRadius: 20,
        padding:      "24px",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h3
          style={{
            color:      "#e0e8ff",
            fontSize:   16,
            fontWeight: 700,
            marginBottom: 4,
          }}
        >
          AI 洞察问答
        </h3>
        <p style={{ color: "#4f6490", fontSize: 12 }}>
          输入问题，大模型将从调研数据中提取信息并动态生成可视化方案
        </p>
      </div>

      {/* Suggested questions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        {SUGGESTED.map((s) => (
          <button
            key={s}
            onClick={() => handleSubmit(s)}
            style={{
              padding:      "5px 13px",
              borderRadius: "20px",
              background:   "rgba(0,201,167,0.08)",
              border:       "1px solid rgba(0,201,167,0.2)",
              color:        "#00c9a7",
              fontSize:     12,
              cursor:       "pointer",
              transition:   "background 0.15s",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: 10 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="例：哪个标签出现最多？正面情感的主要原因是什么？"
          style={{
            flex:         1,
            padding:      "10px 16px",
            borderRadius: "12px",
            background:   "#111e35",
            border:       "1px solid #1a2e4a",
            color:        "#e0e8ff",
            fontSize:     14,
            outline:      "none",
          }}
        />
        <button
          onClick={() => handleSubmit()}
          disabled={loading}
          style={{
            padding:      "10px 24px",
            borderRadius: "12px",
            background:   loading
              ? "rgba(0,201,167,0.3)"
              : "linear-gradient(135deg, #00c9a7, #818cf8)",
            color:        "#060b18",
            fontWeight:   700,
            fontSize:     14,
            cursor:       loading ? "not-allowed" : "pointer",
            border:       "none",
            whiteSpace:   "nowrap",
            transition:   "opacity 0.15s",
          }}
        >
          {loading ? "生成中…" : "生成"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <p
          style={{
            color:     "#fb7185",
            fontSize:  13,
            marginTop: 14,
            padding:   "8px 12px",
            background:"rgba(251,113,133,0.08)",
            borderRadius: 8,
          }}
        >
          ⚠ {error}
        </p>
      )}

      {/* Result */}
      {plan && (
        <div style={{ marginTop: 24 }}>
          <DynamicRenderer plan={plan} />
        </div>
      )}
    </div>
  );
}
