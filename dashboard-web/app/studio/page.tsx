"use client";

/**
 * /studio — GenUI 调研助手
 *
 * 架构：
 *   输入框（顶部固定）→ POST /api/generate-dashboard
 *   → 大模型返回 { answer, layout[] }
 *   → DynamicRenderer 动态渲染组件
 *
 * 路由规范：全屏独立路由，禁止半屏浮层
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { DashboardLayout } from "@/components/DynamicRenderer";

const DynamicRenderer = dynamic(
  () => import("@/components/DynamicRenderer"),
  { ssr: false, loading: () => <SkeletonGrid /> }
);

// ── Types ─────────────────────────────────────────────────────
interface ProjectOption {
  slug:         string;
  name:         string;
  goal:         string;
  hasData:      boolean;
  lastAnalyzed: string | null;
}

// ── Skeleton loader ───────────────────────────────────────────
function SkeletonCard({ wide }: { wide?: boolean }) {
  return (
    <div
      style={{
        gridColumn:   wide ? "1 / -1" : undefined,
        background:   "#0c1525",
        border:       "1px solid #1a2e4a",
        borderRadius: 18,
        padding:      "22px 24px",
        height:       wide ? 160 : 220,
        overflow:     "hidden",
        position:     "relative",
      }}
    >
      <div
        style={{
          position:   "absolute",
          inset:      0,
          background: "linear-gradient(90deg,transparent 0%,rgba(26,46,74,0.5) 50%,transparent 100%)",
          backgroundSize: "400px 100%",
          animation:  "shimmer 1.6s linear infinite",
        }}
      />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
      <SkeletonCard wide />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard wide />
    </div>
  );
}

// ── Example prompts ────────────────────────────────────────────
const EXAMPLES = [
  { icon: "📊", text: "帮我统计各痛点的出现频次并排行" },
  { icon: "💬", text: "挑选 6 条最典型的负面情感用户原声" },
  { icon: "🔍", text: "对比苹果和安卓在帖子中的用户评价差异" },
  { icon: "💰", text: "分析用户的价格敏感度分布情况" },
  { icon: "🏆", text: "展示被提及最多的竞品品牌排行" },
  { icon: "🎯", text: "总结用户最核心的产品期望有哪些" },
];

// ── History item ──────────────────────────────────────────────
interface HistoryEntry {
  id:     number;
  query:  string;
  result: DashboardLayout;
}

// ════════════════════════════════════════════════════════════════
// Page
// ════════════════════════════════════════════════════════════════
export default function StudioPage() {
  const [projects,   setProjects]   = useState<ProjectOption[]>([]);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [query,      setQuery]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [history,    setHistory]    = useState<HistoryEntry[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  // Load project list on mount
  useEffect(() => {
    fetch("/api/generate-dashboard")
      .then((r) => r.json())
      .then((data: ProjectOption[]) => {
        setProjects(data);
        // Pre-select all projects that have data
        setSelected(new Set(data.filter((p) => p.hasData).map((p) => p.slug)));
      })
      .catch(console.error);
  }, []);

  const toggleProject = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  };

  const submit = useCallback(async (q?: string) => {
    const text = (q ?? query).trim();
    if (!text || loading) return;
    if (q) setQuery(q);

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/generate-dashboard", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          query: text,
          slugs: [...selected],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const data = (await res.json()) as DashboardLayout;
      const entry: HistoryEntry = { id: Date.now(), query: text, result: data };
      setHistory((prev) => [entry, ...prev]);

      // Scroll to result
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [query, selected, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const hasData = projects.some((p) => p.hasData);
  const latest  = history[0];

  return (
    <div style={{ minHeight: "100vh", background: "#060b18" }}>

      {/* ── Sticky header ──────────────────────────────────── */}
      <header
        style={{
          position:       "sticky",
          top:            0,
          zIndex:         50,
          borderBottom:   "1px solid rgba(26,46,74,0.8)",
          background:     "rgba(6,11,24,0.85)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin:   "0 auto",
            padding:  "0 32px",
            height:   58,
            display:  "flex",
            alignItems: "center",
            gap:      16,
          }}
        >
          <Link href="/" style={{ color: "#39527a", fontSize: 13, textDecoration: "none", flexShrink: 0 }}>
            ← 返回
          </Link>
          <div
            style={{
              width:        1,
              height:       18,
              background:   "#1a2e4a",
              flexShrink:   0,
            }}
          />
          {/* Logo mark */}
          <div
            style={{
              width:        28,
              height:       28,
              borderRadius: 8,
              background:   "linear-gradient(135deg,#00c9a7,#818cf8)",
              display:      "flex",
              alignItems:   "center",
              justifyContent: "center",
              fontSize:     13,
              fontWeight:   900,
              color:        "#060b18",
              flexShrink:   0,
            }}
          >
            G
          </div>
          <span style={{ color: "#e0e8ff", fontSize: 14, fontWeight: 700 }}>
            GenUI Studio
          </span>
          <span
            style={{
              padding:      "2px 8px",
              borderRadius: 20,
              background:   "rgba(129,140,248,0.12)",
              color:        "#818cf8",
              fontSize:     11,
              fontWeight:   600,
            }}
          >
            生成式 UI
          </span>

          <div style={{ flex: 1 }} />

          {/* Session history count */}
          {history.length > 0 && (
            <span style={{ color: "#39527a", fontSize: 12 }}>
              本次会话 {history.length} 次查询
            </span>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 32px 100px" }}>

        {/* ── Hero ─────────────────────────────────────────── */}
        <section style={{ textAlign: "center", marginBottom: 48 }}>
          <h1
            style={{
              fontSize:   "38px",
              fontWeight: 900,
              letterSpacing: "-0.02em",
              background: "linear-gradient(90deg,#e0e8ff 0%,#818cf8 55%,#00c9a7 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor:  "transparent",
              backgroundClip: "text",
              marginBottom: 12,
              lineHeight:   1.2,
            }}
          >
            调研数据，随问随看
          </h1>
          <p style={{ color: "#6b82ab", fontSize: 15, lineHeight: 1.7, maxWidth: 540, margin: "0 auto" }}>
            输入自然语言，大模型自动读取调研数据库、选择最合适的图表组合，实时渲染可视化看板。
          </p>
        </section>

        {/* ── Project selector ─────────────────────────────── */}
        {projects.length > 0 && (
          <section style={{ marginBottom: 28 }}>
            <p style={{ color: "#4f6490", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              数据源（可多选）
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {projects.map((p) => {
                const active = selected.has(p.slug);
                return (
                  <button
                    key={p.slug}
                    onClick={() => p.hasData && toggleProject(p.slug)}
                    disabled={!p.hasData}
                    style={{
                      padding:      "8px 16px",
                      borderRadius: 12,
                      border:       `1px solid ${active ? "#00c9a7" : "#1a2e4a"}`,
                      background:   active ? "rgba(0,201,167,0.1)" : "#0c1525",
                      color:        active ? "#00c9a7" : p.hasData ? "#8ea3cb" : "#39527a",
                      fontSize:     13,
                      fontWeight:   active ? 600 : 400,
                      cursor:       p.hasData ? "pointer" : "not-allowed",
                      transition:   "all 0.2s",
                      display:      "flex",
                      alignItems:   "center",
                      gap:          8,
                    }}
                  >
                    <span
                      style={{
                        width:        8,
                        height:       8,
                        borderRadius: "50%",
                        background:   p.hasData ? (active ? "#00c9a7" : "#39527a") : "#1a2e4a",
                        flexShrink:   0,
                      }}
                    />
                    {p.name}
                    {!p.hasData && (
                      <span style={{ color: "#39527a", fontSize: 10 }}>（无数据）</span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Input area ────────────────────────────────────── */}
        <section style={{ marginBottom: 36 }}>
          {/* Textarea */}
          <div
            style={{
              position:     "relative",
              background:   "#0c1525",
              border:       `1px solid ${loading ? "#818cf8" : "#1a2e4a"}`,
              borderRadius: 16,
              transition:   "border-color 0.2s",
              overflow:     "hidden",
            }}
          >
            {/* Animated border glow when loading */}
            {loading && (
              <div
                style={{
                  position:   "absolute",
                  inset:      -1,
                  borderRadius: 16,
                  background: "linear-gradient(90deg,#00c9a7,#818cf8,#f472b6,#00c9a7)",
                  backgroundSize: "300% 100%",
                  animation:  "aurora-drift 2s linear infinite",
                  zIndex:     0,
                  opacity:    0.6,
                }}
              />
            )}
            <div style={{ position: "relative", zIndex: 1, background: "#0c1525", borderRadius: 15 }}>
              <textarea
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  !hasData
                    ? "请先运行 clean_data.py 生成调研数据…"
                    : "输入自然语言问题，按 Enter 生成（Shift+Enter 换行）\n例：帮我对比苹果和安卓的痛点差异"
                }
                disabled={!hasData || loading}
                rows={3}
                style={{
                  width:      "100%",
                  padding:    "18px 20px 8px",
                  background: "transparent",
                  border:     "none",
                  color:      "#e0e8ff",
                  fontSize:   14,
                  lineHeight: 1.7,
                  resize:     "none",
                  outline:    "none",
                  fontFamily: "inherit",
                }}
              />
              <div
                style={{
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "space-between",
                  padding:        "8px 16px 12px",
                }}
              >
                <span style={{ color: "#39527a", fontSize: 11 }}>
                  Enter 生成 · Shift+Enter 换行
                </span>
                <button
                  onClick={() => submit()}
                  disabled={!hasData || loading || !query.trim()}
                  style={{
                    padding:      "8px 22px",
                    borderRadius: 10,
                    background:
                      !hasData || loading || !query.trim()
                        ? "rgba(26,46,74,0.6)"
                        : "linear-gradient(135deg,#00c9a7,#818cf8)",
                    color:        !hasData || loading || !query.trim() ? "#39527a" : "#060b18",
                    fontWeight:   700,
                    fontSize:     13,
                    cursor:       !hasData || loading || !query.trim() ? "not-allowed" : "pointer",
                    border:       "none",
                    transition:   "all 0.2s",
                    whiteSpace:   "nowrap",
                  }}
                >
                  {loading ? "生成中…" : "生成看板"}
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                marginTop:    12,
                padding:      "10px 16px",
                borderRadius: 10,
                background:   "rgba(251,113,133,0.08)",
                border:       "1px solid rgba(251,113,133,0.2)",
                color:        "#fb7185",
                fontSize:     13,
              }}
            >
              ⚠ {error}
            </div>
          )}
        </section>

        {/* ── Example prompts (shown only when no history) ── */}
        {history.length === 0 && !loading && (
          <section style={{ marginBottom: 48 }}>
            <p style={{ color: "#4f6490", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 16 }}>
              示例问题
            </p>
            <div
              style={{
                display:             "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap:                 12,
              }}
            >
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.text}
                  onClick={() => submit(ex.text)}
                  disabled={!hasData || loading}
                  style={{
                    padding:      "14px 16px",
                    borderRadius: 14,
                    background:   "#0c1525",
                    border:       "1px solid #1a2e4a",
                    color:        "#8ea3cb",
                    fontSize:     13,
                    textAlign:    "left",
                    cursor:       hasData ? "pointer" : "not-allowed",
                    transition:   "border-color 0.15s, color 0.15s",
                    display:      "flex",
                    alignItems:   "flex-start",
                    gap:          10,
                    lineHeight:   1.5,
                  }}
                  onMouseEnter={(e) => {
                    if (hasData) {
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#00c9a7";
                      (e.currentTarget as HTMLButtonElement).style.color = "#e0e8ff";
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a2e4a";
                    (e.currentTarget as HTMLButtonElement).style.color = "#8ea3cb";
                  }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{ex.icon}</span>
                  <span>{ex.text}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Loading skeleton ────────────────────────────── */}
        {loading && (
          <section style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div
                style={{
                  width:        10,
                  height:       10,
                  borderRadius: "50%",
                  background:   "#00c9a7",
                  animation:    "aurora-drift 1s ease-in-out infinite",
                }}
              />
              <span style={{ color: "#6b82ab", fontSize: 13 }}>
                大模型正在分析数据，选择最合适的图表组合…
              </span>
            </div>
            <SkeletonGrid />
          </section>
        )}

        {/* ── Result history ───────────────────────────────── */}
        <div ref={resultRef}>
          {history.map((entry, hi) => (
            <section key={entry.id} style={{ marginBottom: 56 }}>
              {/* Query label */}
              <div
                style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          12,
                  marginBottom: 24,
                }}
              >
                <div
                  style={{
                    width:        28,
                    height:       28,
                    borderRadius: "50%",
                    background:   hi === 0 ? "linear-gradient(135deg,#00c9a7,#818cf8)" : "#111e35",
                    border:       hi === 0 ? "none" : "1px solid #1a2e4a",
                    display:      "flex",
                    alignItems:   "center",
                    justifyContent:"center",
                    fontSize:     11,
                    fontWeight:   700,
                    color:        hi === 0 ? "#060b18" : "#39527a",
                    flexShrink:   0,
                  }}
                >
                  Q
                </div>
                <p
                  style={{
                    color:      hi === 0 ? "#e0e8ff" : "#6b82ab",
                    fontSize:   14,
                    fontWeight: hi === 0 ? 600 : 400,
                    flex:       1,
                  }}
                >
                  {entry.query}
                </p>
                {hi > 0 && (
                  <span style={{ color: "#39527a", fontSize: 11, flexShrink: 0 }}>历史</span>
                )}
              </div>

              {/* Dynamic render */}
              <DynamicRenderer plan={entry.result} />

              {/* Divider between entries */}
              {hi < history.length - 1 && (
                <div
                  style={{
                    height:     1,
                    background: "linear-gradient(90deg,transparent,#1a2e4a 30%,#1a2e4a 70%,transparent)",
                    marginTop:  48,
                  }}
                />
              )}
            </section>
          ))}
        </div>

        {/* ── Empty state ──────────────────────────────────── */}
        {!loading && history.length === 0 && !hasData && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ color: "#4f6490", fontSize: 14, lineHeight: 1.8 }}>
              当前没有可用的调研数据。<br />
              请先运行 <code style={{ color: "#00c9a7", background: "#0c1525", padding: "2px 6px", borderRadius: 4 }}>
                python clean_data.py --project 01_College_Students
              </code><br />
              生成 <code style={{ color: "#818cf8" }}>latest.json</code> 后刷新此页。
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
