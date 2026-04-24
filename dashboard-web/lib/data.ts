import fs from "fs";
import path from "path";

// ── Path resolution: local vs Vercel ─────────────────────────
//
// Local dev:  dashboard-web/../Data_Engine/Projects/<slug>/
//   Next.js runs from dashboard-web/, Data_Engine is one level up.
//
// Vercel:     dashboard-web/data/<slug>/
//   Only the dashboard-web/ directory is deployed. Data is synced
//   here by publish.sh before every `git push`.
//
// Detection: Vercel always sets VERCEL=1 in the runtime environment.
// We also fall back to the bundled data/ dir if Data_Engine is absent
// (handles Docker / CI scenarios).

const IS_VERCEL = process.env.VERCEL === "1";

const LOCAL_DATA_ENGINE = path.resolve(process.cwd(), "../Data_Engine");
const LOCAL_PROJECTS_DIR = path.join(LOCAL_DATA_ENGINE, "Projects");

const BUNDLED_DATA_DIR = path.join(process.cwd(), "data"); // dashboard-web/data/

function getProjectsDir(): string {
  if (IS_VERCEL) return BUNDLED_DATA_DIR;
  // Local: prefer Data_Engine if it exists, fall back to bundled data/
  if (fs.existsSync(LOCAL_PROJECTS_DIR)) return LOCAL_PROJECTS_DIR;
  return BUNDLED_DATA_DIR;
}

const PROJECTS_DIR = getProjectsDir();

export interface ProjectMeta {
  slug: string;
  name: string;
  goal: string;
  hasData: boolean;
  lastAnalyzed: string | null;
}

export interface AnalysisData {
  meta: {
    project: string;
    goal_summary: string;
    model: string;
    processed_at: string;
    total_raw: number;
    total_analyzed: number;
    errors: number;
  };
  aggregate_insights: AggregateInsights;
  tag_frequency: Record<string, number>;
  sentiment_breakdown: { positive: number; negative: number; neutral: number };
  posts: PostData[];
}

export interface AggregateInsights {
  executive_summary: string;
  top_pain_points: { point: string; frequency: number; severity: string }[];
  top_desires: { desire: string; frequency: number }[];
  top_use_scenarios: string[];
  competitive_mentions: { brand: string; sentiment: string; count: number }[];
  price_sensitivity_distribution: Record<string, number>;
  sentiment_breakdown: Record<string, number>;
  top_tags: { tag: string; count: number }[];
  key_recommendations: string[];
}

export interface PostData {
  note_id?: string;
  title?: string;
  content?: string;
  author?: string;
  likes: number;
  collects: number;
  comments: number;
  created_at?: string;
  platform?: string;
  llm_analysis: {
    summary?: string;
    sentiment?: "positive" | "negative" | "neutral";
    sentiment_reason?: string;
    tags?: string[];
    pain_points?: string[];
    desires?: string[];
    use_scenarios?: string[];
    mentioned_products?: string[];
    price_sensitivity?: string;
    quality_score?: number;
    error?: string;
  };
}

export function listProjects(): ProjectMeta[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];

  return fs
    .readdirSync(PROJECTS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const slug = d.name;
      const projectDir = path.join(PROJECTS_DIR, slug);
      const goalFile = path.join(projectDir, "goal.txt");
      const latestFile = path.join(projectDir, "clean_data", "latest.json");

      const goal = fs.existsSync(goalFile)
        ? fs.readFileSync(goalFile, "utf-8").split("\n")[0].replace("【调研项目】", "").trim()
        : slug;

      let lastAnalyzed: string | null = null;
      if (fs.existsSync(latestFile)) {
        try {
          const d = JSON.parse(fs.readFileSync(latestFile, "utf-8"));
          lastAnalyzed = d?.meta?.processed_at ?? null;
        } catch {}
      }

      return {
        slug,
        name: slug.replace(/^\d+_/, "").replace(/_/g, " "),
        goal,
        hasData: fs.existsSync(latestFile),
        lastAnalyzed,
      };
    });
}

export function getProjectAnalysis(slug: string): AnalysisData | null {
  const latestFile = path.join(PROJECTS_DIR, slug, "clean_data", "latest.json");
  if (!fs.existsSync(latestFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(latestFile, "utf-8"));
  } catch {
    return null;
  }
}

// ── Compact context builder for LLM prompts ───────────────────
// Keeps token budget manageable while preserving all analytically
// useful signals (aggregates + top posts sample).
export interface CompactProjectContext {
  slug:                string;
  goal_summary:        string;
  total_raw:           number;
  total_analyzed:      number;
  sentiment_breakdown: { positive: number; negative: number; neutral: number };
  tag_frequency:       Record<string, number>;   // top 30
  aggregate_insights:  AggregateInsights;
  posts_sample:        CompactPost[];            // top 25 by quality_score
}

export interface CompactPost {
  note_id?:       string;
  title?:         string;
  content?:       string;   // first 120 chars
  author?:        string;
  likes:          number;
  collects:       number;
  comments:       number;
  platform?:      string;
  sentiment?:     string;
  tags?:          string[];
  pain_points?:   string[];
  desires?:       string[];
  quality_score?: number;
  summary?:       string;
}

function toCompactPost(p: PostData): CompactPost {
  return {
    note_id:       p.note_id,
    title:         p.title,
    content:       p.content?.slice(0, 120),
    author:        p.author,
    likes:         p.likes,
    collects:      p.collects,
    comments:      p.comments,
    platform:      p.platform,
    sentiment:     p.llm_analysis?.sentiment,
    tags:          p.llm_analysis?.tags,
    pain_points:   p.llm_analysis?.pain_points,
    desires:       p.llm_analysis?.desires,
    quality_score: p.llm_analysis?.quality_score,
    summary:       p.llm_analysis?.summary,
  };
}

export function getCompactContext(slug: string): CompactProjectContext | null {
  const data = getProjectAnalysis(slug);
  if (!data) return null;

  // Top 30 tags only
  const top30Tags = Object.fromEntries(
    Object.entries(data.tag_frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
  );

  // Top 25 posts sorted by quality_score descending
  const top25Posts = [...data.posts]
    .filter((p) => !p.llm_analysis?.error)
    .sort(
      (a, b) =>
        (b.llm_analysis?.quality_score ?? 0) -
        (a.llm_analysis?.quality_score ?? 0)
    )
    .slice(0, 25)
    .map(toCompactPost);

  return {
    slug,
    goal_summary:        data.meta.goal_summary,
    total_raw:           data.meta.total_raw,
    total_analyzed:      data.meta.total_analyzed,
    sentiment_breakdown: data.sentiment_breakdown,
    tag_frequency:       top30Tags,
    aggregate_insights:  data.aggregate_insights,
    posts_sample:        top25Posts,
  };
}

export function getCompactContextMulti(
  slugs: string[]
): CompactProjectContext[] {
  return slugs
    .map((s) => getCompactContext(s))
    .filter((c): c is CompactProjectContext => c !== null);
}
