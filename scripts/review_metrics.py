#!/usr/bin/env python3
"""AIレビューの指摘を、ルール別に集計する。

期間内に更新された PR のレビュースレッドを `gh api graphql` で取得する。先頭コメントに
`<!-- ai-review:rule=<ID> -->` のマーカーがあるスレッドだけを対象に、ルール（またはルール外の観点）ごとに
件数・outdated 率・resolved 率・👍/👎/😕 の数を出す。

使い方:
    python3 scripts/review_metrics.py                    # 直近 30 日、カレントリポジトリ
    python3 scripts/review_metrics.py --since 2026-09-01 --until 2026-09-30
    python3 scripts/review_metrics.py --repo owner/name --min-count 10

前提: `gh auth login` 済みであること。標準ライブラリだけで動く。
"""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta

# Rule IDs (DEF-001) for the rules perspective, perspective IDs (SECURITY, TESTS) for the others.
MARKER = re.compile(r"<!--\s*ai-review:rule=([A-Z]+(?:-\d+)?)\s*-->")

QUERY = """
query($q: String!, $cursor: String) {
  search(query: $q, type: ISSUE, first: 25, after: $cursor) {
    pageInfo { hasNextPage endCursor }
    nodes {
      ... on PullRequest {
        number
        reviewThreads(first: 100) {
          nodes {
            isResolved
            isOutdated
            comments(first: 1) {
              nodes {
                body
                reactionGroups { content reactors { totalCount } }
              }
            }
          }
        }
      }
    }
  }
}
"""


@dataclass
class RuleStats:
    count: int = 0
    outdated: int = 0
    resolved: int = 0
    reactions: dict[str, int] = field(
        default_factory=lambda: {"THUMBS_UP": 0, "THUMBS_DOWN": 0, "CONFUSED": 0}
    )


def gh_graphql(query: str, variables: dict[str, str | None]) -> dict:
    cmd = ["gh", "api", "graphql", "-f", f"query={query}"]
    for key, value in variables.items():
        if value is not None:
            cmd += ["-f", f"{key}={value}"]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        sys.exit(f"gh api graphql が失敗しました:\n{result.stderr}")
    return json.loads(result.stdout)


def current_repo() -> str:
    result = subprocess.run(
        ["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        sys.exit(f"リポジトリを特定できません。--repo を指定してください:\n{result.stderr}")
    return result.stdout.strip()


def fetch_threads(repo: str, since: date, until: date):
    q = f"repo:{repo} is:pr updated:{since.isoformat()}..{until.isoformat()}"
    cursor = None
    while True:
        data = gh_graphql(QUERY, {"q": q, "cursor": cursor})["data"]["search"]
        for pr in data["nodes"]:
            for thread in (pr.get("reviewThreads") or {}).get("nodes", []):
                yield thread
        if not data["pageInfo"]["hasNextPage"]:
            return
        cursor = data["pageInfo"]["endCursor"]


def aggregate(threads) -> dict[str, RuleStats]:
    stats: dict[str, RuleStats] = defaultdict(RuleStats)
    for thread in threads:
        comments = thread["comments"]["nodes"]
        if not comments:
            continue
        head = comments[0]
        match = MARKER.search(head["body"] or "")
        if not match:
            continue
        s = stats[match.group(1)]
        s.count += 1
        s.outdated += thread["isOutdated"]
        s.resolved += thread["isResolved"]
        for group in head.get("reactionGroups") or []:
            if group["content"] in s.reactions:
                s.reactions[group["content"]] += group["reactors"]["totalCount"]
    return dict(stats)


def pct(n: int, d: int) -> str:
    return f"{n / d * 100:5.1f}%" if d else "    -"


def hints(s: RuleStats) -> list[str]:
    up, down, confused = (s.reactions[k] for k in ("THUMBS_UP", "THUMBS_DOWN", "CONFUSED"))
    out = []
    if down > up and down > 0:
        out.append(
            "👎 が多い → 誤指摘を通している。ルールなら rules.md の「指摘しないこと」、"
            "ルール外の観点なら検出役・検証役の定義を見直す"
        )
    if confused > up and confused > 0:
        out.append("😕 が多い → ルール（または観点）の削除を検討する")
    outdated_rate = s.outdated / s.count if s.count else 0
    if outdated_rate < 0.2:
        out.append("outdated 率が低い → 指摘が直されていない。ルール（または観点）の削除を検討する")
    elif outdated_rate > 0.8:
        out.append("outdated 率が高い → 機械的に直せている。静的解析への移行を検討する")
    return out


def report(stats: dict[str, RuleStats], repo: str, since: date, until: date, min_count: int):
    print(f"AIレビュー ルール別集計: {repo}  {since} 〜 {until}")
    print()
    if not stats:
        print("対象のスレッドがありません（先頭コメントに ai-review:rule マーカーがあるもの）。")
        return
    header = f"{'rule':<10}{'件数':>6}{'outdated':>10}{'resolved':>10}{'👍':>6}{'👎':>6}{'😕':>6}  備考"
    print(header)
    print("-" * len(header))
    for rule in sorted(stats):
        s = stats[rule]
        note = "参考値（件数が少ない）" if s.count < min_count else ""
        print(
            f"{rule:<10}{s.count:>6}{pct(s.outdated, s.count):>10}{pct(s.resolved, s.count):>10}"
            f"{s.reactions['THUMBS_UP']:>6}{s.reactions['THUMBS_DOWN']:>6}"
            f"{s.reactions['CONFUSED']:>6}  {note}"
        )
    print()
    print("判定の目安:")
    any_hint = False
    for rule in sorted(stats):
        s = stats[rule]
        if s.count < min_count:
            continue
        for h in hints(s):
            print(f"  {rule}: {h}")
            any_hint = True
    if not any_hint:
        print(f"  （件数 {min_count} 以上のルールで、目安に当たるものはありません）")
    print()
    print("注意:")
    print("  outdated は、指摘した行が後から変更されたことを示すだけで、指摘を受けて直したことの")
    print("  証明ではない（rebase や無関係な修正でも outdated になる）。")
    print("  リアクションは任意なので、付いていないスレッドの方が多い。件数と合わせて読むこと。")


def main() -> None:
    parser = argparse.ArgumentParser(description="AIレビューの指摘をルール別に集計する")
    parser.add_argument("--repo", help="owner/name（省略時はカレントリポジトリ）")
    parser.add_argument("--since", type=date.fromisoformat, help="開始日 YYYY-MM-DD（既定: 30 日前）")
    parser.add_argument("--until", type=date.fromisoformat, help="終了日 YYYY-MM-DD（既定: 今日）")
    parser.add_argument(
        "--min-count", type=int, default=5, help="これ未満の件数のルールは参考値として扱う（既定: 5）"
    )
    args = parser.parse_args()

    until = args.until or date.today()
    since = args.since or until - timedelta(days=30)
    repo = args.repo or current_repo()
    report(aggregate(fetch_threads(repo, since, until)), repo, since, until, args.min_count)


if __name__ == "__main__":
    main()
