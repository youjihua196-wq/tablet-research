#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Data_Engine/clean_data.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
智能体驱动的两阶段数据清洗流水线

  Phase 1 ── Planner（自动规划）
    读取 goal.txt → 调用 LLM → 生成针对性的清洗 Prompt + JSON Schema
    → 保存至 Projects/{project}/generated_prompt.txt（供复用与人工审阅）

  Phase 2 ── Executor（批量清洗）
    读取所有原始 CSV → 用 Phase 1 的 Prompt 异步并发清洗每条帖子
    → 聚合洞察 → 写入 clean_data/latest.json

用法：
    python clean_data.py --project 01_College_Students
    python clean_data.py --project 01_College_Students --model gpt-4o --concurrency 5
    python clean_data.py --project 01_College_Students --skip-plan    # 跳过 Phase 1，复用已有 Prompt
    python clean_data.py --project 01_College_Students --dry-run      # 不调用 LLM，仅验证数据
    python clean_data.py --project 01_College_Students --limit 50     # 只处理前 N 条
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

import argparse
import asyncio
import json
import os
import random
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from dotenv import load_dotenv

# ═══════════════════════════════════════════════════════════
# 0. 全局路径 & 环境变量
# ═══════════════════════════════════════════════════════════
BASE_DIR     = Path(__file__).parent
PROJECTS_DIR = BASE_DIR / "Projects"

load_dotenv(BASE_DIR / ".env")  # 加载 .env 中的 API Key


# ═══════════════════════════════════════════════════════════
# 1. LLM 适配器（兼容 OpenAI / DeepSeek / Claude）
# ═══════════════════════════════════════════════════════════

class LLMAdapter:
    """
    统一的异步 LLM 调用适配器。
    路由规则：
      - 模型名以 "claude" 开头  → Anthropic SDK
      - 其他（openai / deepseek）→ OpenAI 兼容 SDK，通过环境变量切换 base_url
    """

    def __init__(self, model: str):
        self.model = model
        self._backend: str       # "openai" | "anthropic"
        self._client: Any        # AsyncOpenAI | AsyncAnthropic
        self._init_client()

    def _init_client(self) -> None:
        """根据模型名初始化对应的异步客户端。"""
        if self.model.startswith("claude"):
            # ── Anthropic 路径 ──────────────────────────────
            try:
                from anthropic import AsyncAnthropic  # type: ignore
            except ImportError:
                raise RuntimeError(
                    "Claude 模型需要安装 anthropic 库：pip install anthropic"
                )
            api_key = os.getenv("ANTHROPIC_API_KEY")
            if not api_key:
                raise RuntimeError(
                    "未找到 ANTHROPIC_API_KEY，请在 .env 中配置。"
                )
            self._client  = AsyncAnthropic(api_key=api_key)
            self._backend = "anthropic"

        else:
            # ── OpenAI 兼容路径（OpenAI / DeepSeek / 其他）──
            from openai import AsyncOpenAI  # type: ignore

            if self.model.startswith("deepseek"):
                api_key  = os.getenv("DEEPSEEK_API_KEY") or os.getenv("OPENAI_API_KEY")
                base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
            else:
                api_key  = os.getenv("OPENAI_API_KEY")
                base_url = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")

            if not api_key:
                raise RuntimeError(
                    "未找到 API Key，请在 .env 中配置 OPENAI_API_KEY 或 DEEPSEEK_API_KEY。"
                )
            self._client  = AsyncOpenAI(api_key=api_key, base_url=base_url)
            self._backend = "openai"

    async def chat(
        self,
        system: str,
        user: str,
        temperature: float = 0.3,
    ) -> str:
        """
        发送单次对话请求，返回原始字符串。
        OpenAI 路径启用 json_object 模式；Anthropic 路径由 Prompt 约束输出格式。
        """
        if self._backend == "anthropic":
            resp = await self._client.messages.create(
                model      = self.model,
                max_tokens = 4096,
                system     = system,
                messages   = [{"role": "user", "content": user}],
                temperature= temperature,
            )
            return resp.content[0].text  # type: ignore[union-attr]

        else:
            resp = await self._client.chat.completions.create(
                model          = self.model,
                messages       = [
                    {"role": "system", "content": system},
                    {"role": "user",   "content": user},
                ],
                temperature    = temperature,
                response_format= {"type": "json_object"},
            )
            return resp.choices[0].message.content  # type: ignore[return-value]


# ═══════════════════════════════════════════════════════════
# 2. 工具函数
# ═══════════════════════════════════════════════════════════

def extract_json(raw: str) -> Dict[str, Any]:
    """
    从 LLM 的原始输出中健壮地提取 JSON 对象。
    兼容以下情况：
      - 纯 JSON
      - 被 ```json ... ``` 包裹
      - JSON 前后有多余文字
    """
    text = raw.strip()

    # 尝试移除 Markdown 代码块
    match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if match:
        text = match.group(1)

    # 直接尝试解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # 退而求其次：截取第一个 { 到最后一个 }
    start = text.find("{")
    end   = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError as e:
            raise ValueError(f"无法解析 JSON：{e}\n原始输出片段：{text[start:start+200]}")

    raise ValueError(f"LLM 输出中未找到合法 JSON。原始输出：{text[:300]}")


async def call_with_retry(
    adapter    : LLMAdapter,
    system     : str,
    user       : str,
    max_retries: int   = 4,
    base_delay : float = 1.5,
) -> Dict[str, Any]:
    """
    带指数退避 + 随机抖动的重试包装器。
    - 普通错误：指数退避（1.5s, 3s, 6s, …）
    - 速率限制（429/RateLimitError）：额外加倍等待时间
    - 达到最大重试次数后，返回含 _error 字段的占位字典
    """
    last_err = "unknown"

    for attempt in range(max_retries):
        try:
            raw    = await adapter.chat(system, user)
            result = extract_json(raw)
            return result  # ── 成功 ──

        except ValueError as e:
            # JSON 解析失败，不一定是 API 问题，重试有意义
            last_err = f"JSON解析失败: {e}"
            print(f"    [解析失败] attempt {attempt+1}/{max_retries}: {str(e)[:80]}")

        except Exception as e:
            err_str  = str(e)
            last_err = err_str

            # 判断是否为速率限制错误（openai / anthropic 均可能触发）
            is_rate_limit = (
                "rate_limit" in err_str.lower()
                or "429"      in err_str
                or "RateLimitError" in type(e).__name__
            )

            multiplier = 4.0 if is_rate_limit else 1.0
            wait = base_delay * (2 ** attempt) * multiplier + random.uniform(0, 1)
            label = "速率限制" if is_rate_limit else "API错误"
            print(
                f"    [{label}] attempt {attempt+1}/{max_retries}，"
                f"等待 {wait:.1f}s：{err_str[:80]}"
            )

            if attempt < max_retries - 1:
                await asyncio.sleep(wait)

    return {"_error": last_err}


# ═══════════════════════════════════════════════════════════
# 3. 数据读取 & 标准化
# ═══════════════════════════════════════════════════════════

# 多平台字段名映射表（MediaCrawler 不同平台的列名不一致）
FIELD_MAP: Dict[str, List[str]] = {
    "title"         : ["title", "note_title", "video_title", "post_title", "标题"],
    "content"       : ["desc", "content", "note_content", "video_desc", "正文", "text"],
    "comments_text" : ["comment", "comments_text", "top_comment", "评论摘要"],
    "likes"         : ["liked_count", "like_count", "likes", "digg_count", "点赞数"],
    "collects"      : ["collected_count", "collect_count", "collects", "收藏数"],
    "comments_count": ["comment_count", "comments", "reply_count", "评论数"],
    "created_at"    : ["time", "create_time", "note_create_time", "发布时间", "created_at"],
    "author"        : ["nickname", "user_nickname", "author", "作者"],
    "note_id"       : ["note_id", "id", "aweme_id", "video_id"],
    "platform"      : ["platform", "平台"],
}

# 时间列候选名（与 FIELD_MAP["created_at"] 保持一致，供 apply_date_filter 直接定位原始列）
_TIME_COL_CANDIDATES = ["time", "create_time", "note_create_time", "发布时间", "created_at"]

# 默认时间过滤截止日期（仅保留此日期之后的帖子）
DEFAULT_SINCE_DATE = "2024-01-01"


def _parse_any_timestamp(val: Any) -> Optional[datetime]:
    """
    将原始时间值统一解析为 datetime。
    支持：
      - Unix 时间戳（秒级 / 毫秒级，整数或浮点）
      - 常见日期字符串（"YYYY-MM-DD HH:MM:SS" / "YYYY-MM-DD" 等）
    解析失败时返回 None（调用方决定是否保留该行）。
    """
    if pd.isna(val) or val == "" or val is None:
        return None
    # 数值型时间戳
    try:
        ts = float(val)
        if ts > 1e12:      # 毫秒级，转为秒
            ts /= 1000
        if 0 < ts < 2e9:   # 合理范围（约 1970-2033 年）
            return datetime.fromtimestamp(ts)
    except (ValueError, TypeError, OSError):
        pass
    # 字符串型日期
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S",
        "%Y/%m/%d",
        "%Y年%m月%d日",
    ):
        try:
            return datetime.strptime(str(val)[:19], fmt)
        except ValueError:
            continue
    return None


def apply_date_filter(df: pd.DataFrame, since: str) -> pd.DataFrame:
    """
    删除发布时间早于 since（格式 YYYY-MM-DD）的帖子。

    策略：
    - 自动定位 DataFrame 中的时间列（参照 _TIME_COL_CANDIDATES）
    - 无法识别时间列 → 打印警告，不过滤（宁放过勿误删）
    - 时间值无法解析的行 → 保留（宁放过勿误删）
    - 发布时间 < since → 删除
    """
    since_dt = datetime.strptime(since, "%Y-%m-%d")

    # 定位时间列
    time_col: Optional[str] = None
    for candidate in _TIME_COL_CANDIDATES:
        if candidate in df.columns:
            time_col = candidate
            break

    if time_col is None:
        print(
            f"  [时间过滤] ⚠ 未找到时间列（候选：{_TIME_COL_CANDIDATES}），"
            f"跳过过滤，保留全部 {len(df)} 条"
        )
        return df

    before   = len(df)
    parsed   = df[time_col].apply(_parse_any_timestamp)
    parseable = parsed.notna()

    # 保留：无法解析 OR 时间 >= since_dt
    keep = (~parseable) | (parsed >= since_dt)
    result = df[keep].reset_index(drop=True)

    dropped      = before - len(result)
    unparseable  = (~parseable).sum()

    print(
        f"  [时间过滤] since={since}（列：{time_col}） → "
        f"保留 {len(result)} 条，剔除 {dropped} 条过期帖子"
    )
    if unparseable > 0:
        print(f"  [时间过滤] ⚠ {unparseable} 条时间无法解析，已保留（宁放过勿误删）")

    return result


def _try_read_csv(path: Path) -> Optional[pd.DataFrame]:
    """尝试多种编码读取 CSV，失败返回 None。"""
    for enc in ("utf-8-sig", "utf-8", "gbk", "gb18030"):
        try:
            df = pd.read_csv(path, encoding=enc, low_memory=False)
            return df
        except (UnicodeDecodeError, pd.errors.ParserError):
            continue
    return None


def load_raw_csvs(raw_dir: Path) -> pd.DataFrame:
    """
    读取 raw_data/ 下所有 CSV，合并并去重。
    自动尝试 utf-8-sig / utf-8 / gbk / gb18030 四种编码。
    """
    csv_files = sorted(raw_dir.glob("*.csv"))
    if not csv_files:
        print(f"  [警告] raw_data/ 下未找到 CSV：{raw_dir}")
        return pd.DataFrame()

    frames: List[pd.DataFrame] = []
    for f in csv_files:
        df = _try_read_csv(f)
        if df is None:
            print(f"  ✗ 无法读取（编码问题）：{f.name}")
            continue
        df["_source_file"] = f.name
        frames.append(df)
        print(f"  ✓ {f.name}  →  {len(df)} 行，{len(df.columns)} 列")

    if not frames:
        return pd.DataFrame()

    combined = pd.concat(frames, ignore_index=True)

    # 按常见 ID 字段去重
    id_cols = [c for c in ("note_id", "id", "aweme_id", "video_id") if c in combined.columns]
    if id_cols:
        before = len(combined)
        combined = combined.drop_duplicates(subset=id_cols[0])
        print(f"  → 合并 {len(frames)} 个文件，去重后 {len(combined)} 条（去除 {before - len(combined)} 条重复）")
    else:
        print(f"  → 合并 {len(frames)} 个文件，共 {len(combined)} 条")

    return combined


def normalize_row(row: pd.Series) -> Dict[str, Any]:
    """
    按 FIELD_MAP 将一行数据的字段名统一为标准名称。
    数值字段自动转 int，缺失字段填充默认值。
    """
    result: Dict[str, Any] = {}
    for std_name, candidates in FIELD_MAP.items():
        for col in candidates:
            if col in row.index and pd.notna(row[col]):
                val = row[col]
                # 数值字段：清理逗号、转整型
                if std_name in ("likes", "collects", "comments_count"):
                    try:
                        val = int(float(str(val).replace(",", "").strip()))
                    except (ValueError, TypeError):
                        val = 0
                # 文本字段：统一为字符串
                elif std_name in ("title", "content", "comments_text", "author"):
                    val = str(val).strip()
                result[std_name] = val
                break

        # 未找到时赋默认值
        if std_name not in result:
            if std_name in ("likes", "collects", "comments_count"):
                result[std_name] = 0
            elif std_name in ("title", "content", "comments_text", "author", "platform"):
                result[std_name] = ""
            else:
                result[std_name] = None

    # ── 派生字段：post_date（YYYY-MM-DD）─────────────────────
    # 从 created_at 原始值解析出标准化日期字符串，供前端时序图表使用。
    # 存放在帖子 dict 顶层，与 llm_analysis 并列。
    raw_ts = result.get("created_at")
    dt_obj = _parse_any_timestamp(raw_ts)
    result["post_date"] = dt_obj.strftime("%Y-%m-%d") if dt_obj else ""

    return result


def build_data_sample(df: pd.DataFrame, n: int = 3) -> str:
    """生成供 Planner 参考的数据样例字符串。"""
    lines: list[str] = []
    for i, (_, row) in enumerate(df.head(n).iterrows()):
        norm = normalize_row(row)
        lines.append(
            f"样例{i+1}：\n"
            f"  标题：{str(norm.get('title',''))[:80]}\n"
            f"  正文：{str(norm.get('content',''))[:150]}\n"
            f"  点赞/收藏/评论：{norm.get('likes',0)}/{norm.get('collects',0)}/{norm.get('comments_count',0)}"
        )
    return "\n\n".join(lines)


# ═══════════════════════════════════════════════════════════
# 4. Phase 1 ── Planner（自动规划，生成清洗 Prompt）
# ═══════════════════════════════════════════════════════════

# Planner 的元提示：引导大模型为本次调研定制清洗方案
PLANNER_SYSTEM = """\
你是一位资深用户研究专家和 Prompt 工程师。
你的任务是根据调研目标和数据样例，为后续批量清洗任务生成一套精准可复用的清洗方案。
请严格以 JSON 格式返回，不要输出任何 Markdown 代码块包裹符号（不要用 ```json）。"""

PLANNER_USER_TEMPLATE = """\
以下是一个社交媒体数据清洗任务的背景信息：

【调研项目目标】
{goal_text}

【原始数据包含的字段】
{data_fields}

【数据样例（前{n_samples}条）】
{data_samples}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
请生成以下 JSON 清洗方案，JSON 中每个字段说明如下：

  "system_prompt"    — 清洗 Agent 的系统提示词（100~200字）。
                       需明确：数据来源平台、调研主题、分析维度重点、输出格式要求。

  "user_template"    — 清洗单条帖子的用户提示词模板字符串。
                       必须包含以下占位符（Python str.format_map 语法）：
                         {{title}}          帖子标题
                         {{content}}        帖子正文（已截断至合理长度）
                         {{comments_text}}  评论摘要（可能为空）
                         {{likes}}          点赞数
                         {{collects}}       收藏数
                         {{comments_count}} 评论数
                       末尾须明确要求模型只输出 JSON，不加代码块或其他文字。

  "output_schema"    — 期望模型输出的每个 JSON 字段定义（字典），格式：
                         {{ "字段名": {{ "type": "string|number|array|boolean", "description": "含义与取值说明" }} }}
                       字段设计原则：紧扣调研目标，避免冗余；枚举型字段须列出合法值。

                       ⚠️ 强制要求：output_schema 中必须包含以下字段，不可省略：
                         "post_date": {{"type": "string", "description": "帖子发布日期，格式 YYYY-MM-DD，直接从输入的 post_date 字段透传，用于时序趋势分析"}}
                       （该字段由系统预计算后作为变量传入，模型只需原样输出即可，无需推断）

  "schema_example"   — 符合 output_schema 的一条完整示例输出（字典）。

  "aggregate_focus"  — 聚合分析阶段应重点统计的维度列表（3~5项，如"痛点频率"、"竞品提及"等）。
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""

# 聚合洞察提示（Phase 2 所有帖子清洗完毕后调用）
AGGREGATE_SYSTEM = """\
你是一位资深市场研究分析师，正在为产品团队撰写用户洞察报告。
请严格以 JSON 格式输出，不要用 Markdown 代码块包裹。"""

AGGREGATE_USER_TEMPLATE = """\
以下是"{project_name}"项目的调研背景与 {total} 条社交媒体帖子的结构化分析结果汇总。

【调研目标】
{goal_text}

【本次聚合重点关注维度】
{aggregate_focus}

【帖子分析摘要（按质量评分降序，最多50条）】
{posts_summary}

请输出以下聚合洞察 JSON：
{{
  "executive_summary": "3-4句话的整体洞察摘要",
  "top_pain_points": [
    {{"point": "痛点描述", "frequency": 出现次数估计, "severity": "high|medium|low"}}
  ],
  "top_desires": [
    {{"desire": "期望描述", "frequency": 出现次数估计}}
  ],
  "top_use_scenarios": ["场景1", "场景2"],
  "competitive_mentions": [
    {{"brand": "品牌名", "sentiment": "positive|negative|neutral", "count": 次数}}
  ],
  "price_sensitivity_distribution": {{"high": 0, "medium": 0, "low": 0, "unknown": 0}},
  "sentiment_breakdown": {{"positive": 0, "negative": 0, "neutral": 0}},
  "top_tags": [{{"tag": "标签", "count": 次数}}],
  "key_recommendations": ["建议1", "建议2", "建议3"]
}}
"""


async def run_phase1_planner(
    adapter    : LLMAdapter,
    project_dir: Path,
    df         : pd.DataFrame,
) -> Dict[str, Any]:
    """
    Phase 1：调用 LLM Planner，根据 goal.txt 和数据样例，
    自动生成清洗 Prompt 方案，保存至 generated_prompt.txt。
    若 txt 文件已存在，询问是否覆盖。
    """
    goal_file  = project_dir / "goal.txt"
    goal_text  = goal_file.read_text("utf-8") if goal_file.exists() else "（未提供调研目标）"
    prompt_out = project_dir / "generated_prompt.txt"

    print("\n" + "─" * 55)
    print("  Phase 1 ── Planner：自动规划清洗方案")
    print("─" * 55)
    print(f"  调研目标：{goal_text.splitlines()[0][:60]}...")

    # 构造数据字段说明
    data_fields = "、".join(df.columns.tolist()[:20])
    data_samples = build_data_sample(df, n=3)

    user_msg = PLANNER_USER_TEMPLATE.format(
        goal_text   = goal_text.strip(),
        data_fields = data_fields,
        n_samples   = 3,
        data_samples= data_samples,
    )

    print("  正在调用 Planner LLM，生成清洗 Prompt…", flush=True)
    t0     = time.time()
    result = await call_with_retry(adapter, PLANNER_SYSTEM, user_msg, max_retries=3)
    elapsed = time.time() - t0

    if "_error" in result:
        raise RuntimeError(f"Phase 1 Planner 调用失败：{result['_error']}")

    # 校验关键字段
    required = {"system_prompt", "user_template", "output_schema"}
    missing  = required - result.keys()
    if missing:
        raise RuntimeError(f"Planner 返回结果缺少字段：{missing}\n原始结果：{result}")

    # 保存至文件（JSON 格式，保留可读性）
    meta = {
        "_meta": {
            "generated_at"   : datetime.now().isoformat(),
            "model"          : adapter.model,
            "goal_summary"   : goal_text.splitlines()[0].strip(),
        }
    }
    saved = {**meta, **result}
    prompt_out.write_text(
        json.dumps(saved, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"  ✓ Planner 完成（{elapsed:.1f}s）→ 已保存：{prompt_out.name}")
    print(f"  生成字段：{list(result.keys())}")
    return result


def load_prompt_config(project_dir: Path) -> Dict[str, Any]:
    """
    从 generated_prompt.txt 加载已有的清洗方案（--skip-plan 时使用）。
    """
    prompt_file = project_dir / "generated_prompt.txt"
    if not prompt_file.exists():
        raise FileNotFoundError(
            f"未找到 {prompt_file}，请先运行 Phase 1（去掉 --skip-plan 参数）。"
        )
    cfg = json.loads(prompt_file.read_text("utf-8"))
    # 过滤掉 _meta 字段
    return {k: v for k, v in cfg.items() if not k.startswith("_")}


# ═══════════════════════════════════════════════════════════
# 5. Phase 2 ── Executor（异步并发批量清洗）
# ═══════════════════════════════════════════════════════════

def build_row_prompt(prompt_cfg: Dict[str, Any], row: Dict[str, Any]) -> str:
    """
    用 prompt_cfg["user_template"] 填充单条帖子的占位符，
    生成最终的 user 消息。正文截断至 1500 字，避免超出上下文。
    """
    return prompt_cfg["user_template"].format_map({
        "title"         : str(row.get("title",  ""))[:100],
        "content"       : str(row.get("content",""))[:1500],
        "comments_text" : str(row.get("comments_text",""))[:300],
        "likes"         : row.get("likes",          0),
        "collects"      : row.get("collects",       0),
        "comments_count": row.get("comments_count", 0),
        "post_date"     : row.get("post_date",      ""),   # YYYY-MM-DD，由 normalize_row 预计算
    })


async def run_phase2_executor(
    adapter     : LLMAdapter,
    rows        : List[Dict[str, Any]],
    prompt_cfg  : Dict[str, Any],
    concurrency : int,
    min_interval: float,
) -> List[Dict[str, Any]]:
    """
    Phase 2：使用 asyncio.Semaphore 控制并发度，对所有行异步并发调用 LLM。

    - concurrency   : 最大同时请求数（默认 3，防止速率超限）
    - min_interval  : 每个请求完成后的最短间隔（秒），进一步平滑请求速率
    """
    semaphore = asyncio.Semaphore(concurrency)
    total     = len(rows)
    results: List[Optional[Dict[str, Any]]] = [None] * total

    system_prompt = prompt_cfg.get("system_prompt", "你是一位专业的用户研究分析师。")

    async def process_one(idx: int, row: dict[str, Any]) -> None:
        """处理单条帖子，结果写入 results[idx]。"""
        async with semaphore:
            title = str(row.get("title", ""))[:35] or "(无标题)"
            print(f"  [{idx+1:>4}/{total}] {title}…", end=" ", flush=True)

            user_prompt = build_row_prompt(prompt_cfg, row)
            analysis   = await call_with_retry(
                adapter, system_prompt, user_prompt, max_retries=4
            )

            if "_error" in analysis:
                print(f"✗ {analysis['_error'][:60]}")
            else:
                # 尝试输出关键维度（sentiment / quality_score 等常见字段）
                sentiment = analysis.get("sentiment", analysis.get("情感", "?"))
                score     = analysis.get("quality_score", analysis.get("质量评分", "?"))
                print(f"✓  情感={sentiment}  评分={score}")

            results[idx] = {**row, "llm_analysis": analysis}

            # 每个请求后的最短间隔，平滑速率
            if min_interval > 0:
                await asyncio.sleep(min_interval)

    # 并发启动所有任务
    tasks = [process_one(i, r) for i, r in enumerate(rows)]
    await asyncio.gather(*tasks)

    return results  # type: ignore


# ═══════════════════════════════════════════════════════════
# 6. 聚合洞察（所有帖子处理完毕后调用）
# ═══════════════════════════════════════════════════════════

async def build_aggregate_insights(
    adapter     : LLMAdapter,
    project_name: str,
    goal_text   : str,
    prompt_cfg  : Dict[str, Any],
    analyzed    : List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    对所有分析结果做一次聚合调用，生成执行摘要、TOP 痛点、竞品分析等。
    只将质量最高的前 50 条摘要送入 LLM，控制 Token 成本。
    """
    # 按 quality_score 或等效字段降序排列
    def get_score(p: dict) -> float:
        a = p.get("llm_analysis", {})
        for k in ("quality_score", "质量评分", "score"):
            if k in a:
                try:
                    return float(a[k])
                except (TypeError, ValueError):
                    pass
        return 0.0

    good_posts = [p for p in analyzed if "_error" not in p.get("llm_analysis", {})]
    sorted_posts = sorted(good_posts, key=get_score, reverse=True)

    # 构建摘要行
    summary_lines: List[str] = []
    for p in sorted_posts[:50]:
        a = p["llm_analysis"]
        # 兼容模型自定义字段名
        summary = a.get("summary", a.get("摘要", str(p.get("title",""))[:40]))
        sentiment= a.get("sentiment", a.get("情感", "?"))
        score    = a.get("quality_score", a.get("质量评分", "?"))
        pains    = a.get("pain_points",   a.get("痛点", []))
        desires  = a.get("desires",       a.get("期望", []))
        pains_str  = "、".join(pains[:2])  if isinstance(pains,  list) else str(pains)[:40]
        desires_str= "、".join(desires[:2]) if isinstance(desires, list) else str(desires)[:40]
        summary_lines.append(
            f"- [{sentiment}][{score}] {summary[:50]}"
            f"  | 痛点:{pains_str}  | 期望:{desires_str}"
        )

    agg_focus = "、".join(prompt_cfg.get("aggregate_focus", ["痛点频率", "情感分布", "竞品提及"]))
    user_msg  = AGGREGATE_USER_TEMPLATE.format(
        project_name    = project_name,
        total           = len(analyzed),
        goal_text       = goal_text[:400],
        aggregate_focus = agg_focus,
        posts_summary   = "\n".join(summary_lines),
    )

    print("\n  🧠 生成聚合洞察…", end=" ", flush=True)
    agg = await call_with_retry(adapter, AGGREGATE_SYSTEM, user_msg, max_retries=3)

    if "_error" in agg:
        print(f"✗ 聚合失败：{agg['_error']}")
        return {}
    print("✓")
    return agg


# ═══════════════════════════════════════════════════════════
# 7. 统计工具（从清洗结果中提取频次数据）
# ═══════════════════════════════════════════════════════════

def compute_stats(
    analyzed: List[Dict[str, Any]],
) -> Tuple[Dict[str, int], Dict[str, int]]:
    """
    遍历所有帖子的 llm_analysis，统计：
      - tag_frequency   : 标签出现次数
      - sentiment_counts: 情感分布
    兼容中英文字段名。
    """
    tag_freq    : Dict[str, int] = {}
    sent_counts : Dict[str, int] = {"positive": 0, "negative": 0, "neutral": 0}

    for p in analyzed:
        a = p.get("llm_analysis", {})

        # 标签统计
        tags = a.get("tags", a.get("标签", []))
        if isinstance(tags, list):
            for t in tags:
                tag_freq[t] = tag_freq.get(t, 0) + 1

        # 情感统计（统一英文 key）
        s = a.get("sentiment", a.get("情感", "neutral"))
        if isinstance(s, str):
            s = s.lower().strip()
            if s in sent_counts:
                sent_counts[s] += 1
            else:
                sent_counts["neutral"] += 1

    # 按频次降序截取 TOP 50 标签
    top_tags = dict(sorted(tag_freq.items(), key=lambda x: x[1], reverse=True)[:50])
    return top_tags, sent_counts


# ═══════════════════════════════════════════════════════════
# 8. 主调度函数
# ═══════════════════════════════════════════════════════════

async def run_pipeline(
    project_name: str,
    model       : str,
    concurrency : int,
    skip_plan   : bool,
    dry_run     : bool,
    limit       : Optional[int],
    since_date  : str = DEFAULT_SINCE_DATE,
) -> None:
    """
    完整的两阶段流水线入口（异步）。
    """
    project_dir = PROJECTS_DIR / project_name
    if not project_dir.exists():
        print(f"[错误] 项目目录不存在：{project_dir}")
        sys.exit(1)

    # ── 读取原始数据 ──────────────────────────────────────
    print(f"\n{'═'*55}")
    print(f"  项目：{project_name}")
    print(f"  模型：{model}  并发：{concurrency}  时效截止：{since_date}")
    print(f"{'═'*55}\n")
    print("📂 读取原始 CSV 数据…")

    raw_dir = project_dir / "raw_data"
    df      = load_raw_csvs(raw_dir)

    if df.empty:
        print("\n[退出] raw_data/ 下没有可读取的数据。")
        print("  请先将 MediaCrawler 输出的 CSV 文件放入该目录，再重新运行。")
        sys.exit(0)

    # ── 时效性过滤：剔除 since_date 之前的过期帖子 ──────────
    # 注：MediaCrawler 不提供时间范围 CLI 参数，过滤在此层完成。
    print(f"\n🗓  应用时效性过滤（仅保留 {since_date} 之后的帖子）…")
    df = apply_date_filter(df, since_date)

    if df.empty:
        print(f"\n[退出] 时效性过滤后无剩余数据（所有帖子均早于 {since_date}）。")
        print("  建议：调整 --since 参数或重新抓取更新的数据。")
        sys.exit(0)

    # 可选：限制处理条数（调试用）
    if limit and limit > 0:
        df = df.head(limit)
        print(f"  [--limit] 已截取前 {limit} 条")

    if dry_run:
        print(f"\n[DRY RUN] 共读取 {len(df)} 条数据，不调用 LLM，流程结束。")
        print(f"  列名：{list(df.columns[:15])}")
        return

    # 标准化全部行，得到字典列表
    all_rows = [normalize_row(row) for _, row in df.iterrows()]

    # ── 初始化 LLM 适配器 ─────────────────────────────────
    adapter = LLMAdapter(model)

    # ── Phase 1：自动规划 ─────────────────────────────────
    if skip_plan:
        print("\n⏩ --skip-plan：跳过 Phase 1，加载已有的 generated_prompt.txt")
        prompt_cfg = load_prompt_config(project_dir)
        print(f"  ✓ 已加载：字段 = {list(prompt_cfg.keys())}")
    else:
        prompt_cfg = await run_phase1_planner(adapter, project_dir, df)

    # ── Phase 2：批量清洗 ─────────────────────────────────
    print(f"\n{'─'*55}")
    print(f"  Phase 2 ── Executor：批量清洗 {len(all_rows)} 条帖子")
    print(f"{'─'*55}")

    # 每个请求的最小间隔（秒）= 1.0 / 并发数，保证整体速率平滑
    min_interval = round(1.0 / max(concurrency, 1), 2)

    t_start  = time.time()
    analyzed = await run_phase2_executor(
        adapter      = adapter,
        rows         = all_rows,
        prompt_cfg   = prompt_cfg,
        concurrency  = concurrency,
        min_interval = min_interval,
    )
    t_elapsed = time.time() - t_start

    # 统计成功 / 失败数
    errors   = sum(1 for p in analyzed if "_error" in p.get("llm_analysis", {}))
    success  = len(analyzed) - errors
    print(
        f"\n  ✓ 清洗完成：{success} 成功，{errors} 失败"
        f"（耗时 {t_elapsed:.1f}s，均速 {t_elapsed/len(analyzed):.1f}s/条）"
    )

    # ── 聚合洞察 ──────────────────────────────────────────
    goal_file  = project_dir / "goal.txt"
    goal_text  = goal_file.read_text("utf-8") if goal_file.exists() else ""

    aggregate = await build_aggregate_insights(
        adapter      = adapter,
        project_name = project_name,
        goal_text    = goal_text,
        prompt_cfg   = prompt_cfg,
        analyzed     = analyzed,
    )

    # ── 统计标签 & 情感分布 ───────────────────────────────
    tag_freq, sentiment_breakdown = compute_stats(analyzed)

    # ── 构建最终输出 JSON ─────────────────────────────────
    output = {
        "meta": {
            "project"        : project_name,
            "goal_summary"   : goal_text.splitlines()[0].replace("【调研项目】","").strip(),
            "model"          : model,
            "processed_at"   : datetime.now().isoformat(),
            "since_date"     : since_date,
            "total_raw"      : len(df),
            "total_analyzed" : len(analyzed),
            "success"        : success,
            "errors"         : errors,
            "concurrency"    : concurrency,
            "elapsed_seconds": round(t_elapsed, 1),
        },
        "generated_prompt"  : {
            "system_prompt" : prompt_cfg.get("system_prompt",""),
            "output_schema" : prompt_cfg.get("output_schema",{}),
        },
        "aggregate_insights"     : aggregate,
        "tag_frequency"          : tag_freq,
        "sentiment_breakdown"    : sentiment_breakdown,
        "posts"                  : analyzed,
    }

    # ── 写入文件 ──────────────────────────────────────────
    clean_dir  = project_dir / "clean_data"
    clean_dir.mkdir(exist_ok=True)

    date_str   = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_file   = clean_dir / f"analysis_{date_str}.json"
    latest_file= clean_dir / "latest.json"
    json_str   = json.dumps(output, ensure_ascii=False, indent=2)

    out_file.write_text(json_str, encoding="utf-8")
    latest_file.write_text(json_str, encoding="utf-8")

    print(f"\n{'═'*55}")
    print(f"  ✅ 全部完成！")
    print(f"{'═'*55}")
    print(f"  归档文件：{out_file.relative_to(BASE_DIR)}")
    print(f"  看板读取：{latest_file.relative_to(BASE_DIR)}  ←  Dashboard_Web 将读取此文件")
    print(f"{'═'*55}\n")


# ═══════════════════════════════════════════════════════════
# 9. CLI 入口
# ═══════════════════════════════════════════════════════════

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Data_Engine 智能体清洗流水线（两阶段：Planner → Executor）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例：
  # 全流程（Phase 1 Planner + Phase 2 Executor）
  python clean_data.py --project 01_College_Students

  # 指定模型 & 并发数（适合数据量大时提速）
  python clean_data.py --project 01_College_Students --model gpt-4o --concurrency 5

  # 跳过 Phase 1，直接使用已生成的 generated_prompt.txt
  python clean_data.py --project 01_College_Students --skip-plan

  # 仅验证数据可读性，不调用 LLM
  python clean_data.py --project 01_College_Students --dry-run

  # 只处理前 30 条（快速测试效果）
  python clean_data.py --project 01_College_Students --limit 30
        """,
    )

    parser.add_argument(
        "--project",
        required=True,
        help="Projects/ 下的项目目录名称（如 01_College_Students）",
    )
    parser.add_argument(
        "--model",
        default="deepseek-chat",
        help="LLM 模型名（默认：deepseek-chat；可选：gpt-4o / gpt-4o-mini / claude-3-5-sonnet-20241022）",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=3,
        help="最大并发请求数（默认：3；数值越大速度越快但越易触发速率限制）",
    )
    parser.add_argument(
        "--skip-plan",
        action="store_true",
        help="跳过 Phase 1，直接加载已有的 generated_prompt.txt",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="仅读取 & 解析数据，不调用 LLM（用于验证 CSV 格式）",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="只处理前 N 条数据（调试用；默认处理全部）",
    )
    parser.add_argument(
        "--since",
        default=DEFAULT_SINCE_DATE,
        help=(
            f"时效性截止日期（YYYY-MM-DD），仅保留此日期之后发布的帖子。"
            f"默认：{DEFAULT_SINCE_DATE}。"
            "注：MediaCrawler 不支持时间范围 CLI 参数，过滤在本脚本的数据加载层完成。"
        ),
    )

    args = parser.parse_args()

    asyncio.run(
        run_pipeline(
            project_name = args.project,
            model        = args.model,
            concurrency  = args.concurrency,
            skip_plan    = args.skip_plan,
            dry_run      = args.dry_run,
            limit        = args.limit,
            since_date   = args.since,
        )
    )


if __name__ == "__main__":
    main()
