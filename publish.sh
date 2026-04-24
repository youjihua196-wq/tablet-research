#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════
# publish.sh — 一键全链路发布脚本
#
# 用法：
#   bash publish.sh [项目名] [选项]
#
# 示例：
#   bash publish.sh                               # 处理所有项目，跳过抓取
#   bash publish.sh 01_College_Students           # 只处理指定项目
#   bash publish.sh 01_College_Students --crawl   # 先抓取再清洗
#   bash publish.sh 01_College_Students --crawl --platform dy
#   bash publish.sh 01_College_Students --skip-plan  # 跳过 Planner
#   bash publish.sh 01_College_Students --dry-run    # 不调 LLM，只验证
#
# 流程：
#   [可选] crawl.py → MediaCrawler 抓取 → raw_data/
#   clean_data.py → Planner + Executor → clean_data/latest.json
#   同步 latest.json + goal.txt → dashboard-web/data/
#   git add + commit + push → Vercel 自动重新部署
# ══════════════════════════════════════════════════════════════════

set -e  # 任意步骤失败立即退出

# ── 颜色输出 ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}▶ $*${RESET}"; }
success() { echo -e "${GREEN}✓ $*${RESET}"; }
warn()    { echo -e "${YELLOW}⚠ $*${RESET}"; }
error()   { echo -e "${RED}✗ $*${RESET}"; exit 1; }
banner()  { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════${RESET}"; echo -e "${BOLD}${CYAN}  $*${RESET}"; echo -e "${BOLD}${CYAN}══════════════════════════════════════${RESET}\n"; }

# ── 路径 ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_ENGINE="$SCRIPT_DIR/Data_Engine"
DASHBOARD_DATA="$SCRIPT_DIR/dashboard-web/data"

# ── 参数解析 ──────────────────────────────────────────────────
PROJECT=""
DO_CRAWL=false
PLATFORM="xhs"
KEYWORDS=""
CRAWL_COUNT=200
SKIP_PLAN=false
DRY_RUN=false
MODEL="deepseek-chat"
CONCURRENCY=3
NO_PUSH=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --crawl)       DO_CRAWL=true ;;
    --platform)    PLATFORM="$2"; shift ;;
    --keywords)    KEYWORDS="$2"; shift ;;
    --count)       CRAWL_COUNT="$2"; shift ;;
    --skip-plan)   SKIP_PLAN=true ;;
    --dry-run)     DRY_RUN=true ;;
    --model)       MODEL="$2"; shift ;;
    --concurrency) CONCURRENCY="$2"; shift ;;
    --no-push)     NO_PUSH=true ;;
    --*)           warn "未知选项：$1" ;;
    *)
      if [[ -z "$PROJECT" ]]; then
        PROJECT="$1"
      fi
      ;;
  esac
  shift
done

# ── 确定要处理的项目列表 ───────────────────────────────────────
if [[ -n "$PROJECT" ]]; then
  PROJECTS=("$PROJECT")
else
  # 自动发现所有项目
  PROJECTS=()
  for d in "$DATA_ENGINE/Projects"/*/; do
    name="$(basename "$d")"
    if [[ -f "$d/goal.txt" ]]; then
      PROJECTS+=("$name")
    fi
  done
  if [[ ${#PROJECTS[@]} -eq 0 ]]; then
    error "Data_Engine/Projects/ 下没有找到任何项目（含 goal.txt）"
  fi
  info "自动检测到 ${#PROJECTS[@]} 个项目：${PROJECTS[*]}"
fi

banner "Aurora Research · 全链路发布"
echo -e "  项目：${BOLD}${PROJECTS[*]}${RESET}"
echo -e "  模型：$MODEL  并发：$CONCURRENCY"
echo -e "  抓取：$([ $DO_CRAWL = true ] && echo '是 ('"$PLATFORM"')' || echo '否（跳过）')"
echo -e "  推送：$([ $NO_PUSH = true ] && echo '否（--no-push）' || echo '是')"
echo ""

# ── 环境检查 ───────────────────────────────────────────────────
info "检查 Python 环境…"
PYTHON=$(command -v python3 || command -v python || true)
[[ -z "$PYTHON" ]] && error "未找到 Python，请先安装 Python 3.9+"
PY_VER=$("$PYTHON" --version 2>&1)
success "Python: $PY_VER"

# 检查 .env 是否存在
if [[ ! -f "$DATA_ENGINE/.env" ]]; then
  warn "Data_Engine/.env 不存在，请确保已设置 DEEPSEEK_API_KEY"
  warn "可以复制模板：cp Data_Engine/.env.example Data_Engine/.env"
fi

# ── 逐项目处理 ────────────────────────────────────────────────
CHANGED_PROJECTS=()

for PROJECT in "${PROJECTS[@]}"; do
  PROJECT_DIR="$DATA_ENGINE/Projects/$PROJECT"

  if [[ ! -d "$PROJECT_DIR" ]]; then
    warn "项目目录不存在，跳过：$PROJECT_DIR"
    continue
  fi

  banner "处理项目：$PROJECT"

  # ── Step 1：抓取（可选）────────────────────────────────────
  if [[ $DO_CRAWL = true ]]; then
    info "Step 1/3  抓取原始数据（MediaCrawler）…"
    CRAWL_CMD=("$PYTHON" "$DATA_ENGINE/crawl.py"
      "--project" "$PROJECT"
      "--platform" "$PLATFORM"
      "--count"    "$CRAWL_COUNT")
    [[ -n "$KEYWORDS" ]] && CRAWL_CMD+=("--keywords" "$KEYWORDS")

    echo "  命令：${CRAWL_CMD[*]}"
    "$PYTHON" "$DATA_ENGINE/crawl.py" \
      --project "$PROJECT" \
      --platform "$PLATFORM" \
      --count "$CRAWL_COUNT" \
      ${KEYWORDS:+--keywords "$KEYWORDS"}
    success "抓取完成"
  else
    info "Step 1/3  跳过抓取（使用已有 raw_data/）"
  fi

  # ── Step 2：AI 清洗 ─────────────────────────────────────────
  info "Step 2/3  AI 两阶段清洗（Planner → Executor）…"
  CLEAN_CMD=("$PYTHON" "$DATA_ENGINE/clean_data.py"
    "--project"     "$PROJECT"
    "--model"       "$MODEL"
    "--concurrency" "$CONCURRENCY")
  [[ $SKIP_PLAN = true ]] && CLEAN_CMD+=("--skip-plan")
  [[ $DRY_RUN   = true ]] && CLEAN_CMD+=("--dry-run")

  echo "  命令：${CLEAN_CMD[*]}"
  "${CLEAN_CMD[@]}"

  LATEST="$PROJECT_DIR/clean_data/latest.json"
  if [[ ! -f "$LATEST" ]]; then
    if [[ $DRY_RUN = true ]]; then
      warn "dry-run 模式下不生成 latest.json，跳过同步"
      continue
    fi
    error "clean_data.py 未生成 $LATEST，请检查日志"
  fi
  success "清洗完成 → $LATEST"

  # ── Step 3：同步到 dashboard-web/data/ ────────────────────
  info "Step 3/3  同步至 dashboard-web/data/$PROJECT/ …"
  DEST="$DASHBOARD_DATA/$PROJECT"
  mkdir -p "$DEST"

  cp "$LATEST"                          "$DEST/latest.json"
  cp "$PROJECT_DIR/goal.txt"            "$DEST/goal.txt"

  # 若有 generated_prompt.txt 也一起同步（便于人工查阅，但体积小）
  if [[ -f "$PROJECT_DIR/generated_prompt.txt" ]]; then
    cp "$PROJECT_DIR/generated_prompt.txt" "$DEST/generated_prompt.txt"
  fi

  success "同步完成 → $DEST"
  CHANGED_PROJECTS+=("$PROJECT")
done

# ── Git 提交 & 推送 ───────────────────────────────────────────
if [[ ${#CHANGED_PROJECTS[@]} -eq 0 ]]; then
  warn "没有项目产生变更，跳过 git 操作"
  exit 0
fi

banner "Git 提交 & 推送 → Vercel"

info "暂存变更…"
git -C "$SCRIPT_DIR" add dashboard-web/data/

# 检查是否有实际变更
if git -C "$SCRIPT_DIR" diff --cached --quiet; then
  warn "dashboard-web/data/ 内容与上次相同，无新变更"
  warn "Vercel 不会触发重新部署（数据未更新）"
  exit 0
fi

# 构建 commit message
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
PROJECTS_STR=$(IFS=', '; echo "${CHANGED_PROJECTS[*]}")
COMMIT_MSG="data: update analysis [${PROJECTS_STR}] @ ${TIMESTAMP}"

info "提交：$COMMIT_MSG"
git -C "$SCRIPT_DIR" commit -m "$COMMIT_MSG"
success "Commit 完成"

if [[ $NO_PUSH = true ]]; then
  warn "--no-push 模式，跳过推送（手动运行 git push 触发 Vercel）"
else
  info "推送到远程仓库（触发 Vercel 重新部署）…"
  git -C "$SCRIPT_DIR" push
  success "推送完成！"
  echo ""
  echo -e "  ${GREEN}Vercel 将在约 30~60 秒内完成重新部署。${RESET}"
  echo -e "  可在 Vercel Dashboard → Deployments 查看进度。"
fi

banner "✅ 全部完成"
echo -e "  已更新项目：${BOLD}${PROJECTS_STR}${RESET}"
echo ""
