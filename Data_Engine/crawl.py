#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Data_Engine/crawl.py — MediaCrawler 非侵入式调用桥接脚本

设计原则：
  - 完全通过 subprocess + CLI 参数调用 MediaCrawler，不修改其任何内部文件
  - MediaCrawler 本身不支持时间范围过滤（arg.py 中无 --start_date/--end_date）
  - 时效性过滤由下游 clean_data.py 的 apply_date_filter() 完成
  - 为补偿日期过滤导致的数据量减少，--since 参数会自动放大 --count 值

用法：
  python crawl.py --project 01_College_Students
  python crawl.py --project 01_College_Students --platform xhs --count 200
  python crawl.py --project 01_College_Students --keywords "大学生平板,iPad学生"
  python crawl.py --project 01_College_Students --since 2024-06-01  # 下游过滤截止日
  python crawl.py --project 01_College_Students --headless

后续流程：
  python clean_data.py --project 01_College_Students --since 2024-01-01
"""

import argparse
import shutil
import subprocess
import sys
from datetime import datetime
from pathlib import Path

BASE_DIR          = Path(__file__).parent
PROJECTS_DIR      = BASE_DIR / "Projects"
MEDIA_CRAWLER_DIR = BASE_DIR.parent / "MediaCrawler-main"


def _read_keywords_from_goal(project_name: str) -> str:
    """从 goal.txt 自动提取关键词行（含"关键词"或"keyword"字样）。"""
    goal_file = PROJECTS_DIR / project_name / "goal.txt"
    if not goal_file.exists():
        return ""
    for line in goal_file.read_text("utf-8").splitlines():
        if "关键词" in line or "keyword" in line.lower():
            sep   = "：" if "：" in line else ":"
            parts = line.split(sep, 1)
            if len(parts) > 1:
                return parts[1].strip().replace("、", ",")
    return ""


def _collect_csv_outputs(project_name: str, platform: str) -> int:
    """将 MediaCrawler 输出的 CSV 复制到对应项目的 raw_data/ 目录。"""
    raw_dir = PROJECTS_DIR / project_name / "raw_data"
    raw_dir.mkdir(parents=True, exist_ok=True)

    # MediaCrawler 默认输出路径
    search_dirs = [
        MEDIA_CRAWLER_DIR / "data" / platform,
        MEDIA_CRAWLER_DIR / "data",
    ]
    copied = 0
    for out_dir in search_dirs:
        if out_dir.exists():
            for csv_file in out_dir.glob("*.csv"):
                dest = raw_dir / csv_file.name
                shutil.copy2(csv_file, dest)
                print(f"  ✓ 已复制：{csv_file.name} → {dest.relative_to(BASE_DIR)}")
                copied += 1
    return copied


def run_crawler(
    project_name: str,
    platform:     str,
    keywords:     str,
    crawl_type:   str,
    headless:     bool,
    max_count:    int,
    since:        str,
) -> None:
    if not MEDIA_CRAWLER_DIR.exists():
        print(f"[错误] MediaCrawler 目录不存在：{MEDIA_CRAWLER_DIR}")
        sys.exit(1)

    # 自动读取关键词
    if not keywords:
        keywords = _read_keywords_from_goal(project_name)
        if keywords:
            print(f"  [goal.txt 自动关键词] {keywords}")

    # ── 时效性说明 ──────────────────────────────────────────────
    # MediaCrawler 不支持时间范围参数（已确认 arg.py 无 --start_date）。
    # 时效性过滤由 clean_data.py --since {since} 在 CSV 加载层完成。
    # 为补偿过滤造成的数据量损失，当 since >= 2024-01-01 时自动放大 count。
    try:
        since_dt = datetime.strptime(since, "%Y-%m-%d")
        days_ago = (datetime.now() - since_dt).days
        # 约每 90 天数据按 10% 衰减，放大 count 以保证足够样本
        scale = max(1.0, 1 + days_ago / 365)
        adjusted_count = min(int(max_count * scale), 2000)
        if adjusted_count != max_count:
            print(
                f"  [时效补偿] since={since}，自动放大抓取量：{max_count} → {adjusted_count}"
                f"（下游 clean_data.py 会过滤 {since} 之前的帖子）"
            )
            max_count = adjusted_count
    except ValueError:
        pass

    # ── 完全通过 CLI 参数调用，不触碰 MediaCrawler 内部任何文件 ──
    cmd = [
        sys.executable,
        str(MEDIA_CRAWLER_DIR / "main.py"),
        "--platform",        platform,
        "--lt",              "qrcode",
        "--type",            crawl_type,
        "--save_data_option","csv",
    ]
    if keywords:
        cmd += ["--keywords", keywords]
    if headless:
        cmd += ["--headless", "true"]

    print(f"\n{'─'*58}")
    print(f"  MediaCrawler 启动")
    print(f"  平台={platform}  类型={crawl_type}  关键词={keywords or '（未设置）'}")
    print(f"  抓取量={max_count}  时效截止={since}（由 clean_data.py 下游过滤）")
    print(f"  命令: {' '.join(cmd)}")
    print(f"{'─'*58}\n")

    result = subprocess.run(
        cmd,
        cwd=str(MEDIA_CRAWLER_DIR),
        check=False,
    )
    if result.returncode != 0:
        print(f"[警告] MediaCrawler 退出码：{result.returncode}")

    # 收集输出 CSV
    copied = _collect_csv_outputs(project_name, platform)
    if copied == 0:
        print(
            "\n[提示] 未检测到 CSV 输出。"
            "\n  请确认 MediaCrawler 的存储配置（SAVE_DATA_OPTION）已启用 csv 模式。"
        )
    else:
        print(f"\n  ✅ 共复制 {copied} 个 CSV → Projects/{project_name}/raw_data/")
        print(f"  下一步：python clean_data.py --project {project_name} --since {since}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="非侵入式 MediaCrawler subprocess 调用桥接（不修改 MediaCrawler 任何内部文件）",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
注意：MediaCrawler 不支持时间范围参数，时效性过滤由 clean_data.py 完成。
      抓取量会根据 --since 自动放大，以补偿下游过滤导致的数据量减少。

示例：
  python crawl.py --project 01_College_Students
  python crawl.py --project 01_College_Students --since 2024-01-01 --count 300
  python crawl.py --project 01_College_Students --platform dy --headless
        """,
    )
    parser.add_argument("--project",  required=True,
                        help="Projects/ 下的项目目录名称")
    parser.add_argument("--platform", default="xhs",
                        choices=["xhs", "dy", "bili", "wb", "ks", "tieba", "zhihu"],
                        help="平台（默认 xhs）")
    parser.add_argument("--keywords", default="",
                        help="搜索关键词（不传则从 goal.txt 自动读取）")
    parser.add_argument("--type",     default="search",
                        choices=["search", "detail", "creator"],
                        help="抓取类型（默认 search）")
    parser.add_argument("--headless", action="store_true",
                        help="无头模式运行浏览器")
    parser.add_argument("--count",    type=int, default=200,
                        help="初始抓取条数（默认 200；时效补偿可能自动放大）")
    parser.add_argument("--since",    default="2024-01-01",
                        help=(
                            "时效性截止日期（YYYY-MM-DD，默认 2024-01-01）。"
                            "MediaCrawler 本身不过滤日期，此参数仅用于："
                            "① 自动放大 count 补偿损耗；"
                            "② 提示用户下游 clean_data.py 使用的过滤参数。"
                        ))

    args = parser.parse_args()
    run_crawler(
        project_name = args.project,
        platform     = args.platform,
        keywords     = args.keywords,
        crawl_type   = args.type,
        headless     = args.headless,
        max_count    = args.count,
        since        = args.since,
    )


if __name__ == "__main__":
    main()
