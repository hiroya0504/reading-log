---
description: Run the multi-agent review loop on the current branch — independent reviewers, a refutation pass, then fix and re-review until it converges.
---

Run the review harness on the current branch against `main`.

You are the **orchestrator and the fixer**. You wrote this code, so you must not review it — that is
what the reviewer subagents are for, and their value comes entirely from not sharing your context.

**Never summarise the change for a subagent.** Do not tell them what you intended, what you think is
risky, or which files matter. They read `.review/<branch>/context.md` and the repository. Framing
them is how this harness quietly stops working.

The mechanism and the rationale for each stage are in `docs/review-harness.md`.

---

## Definitions

- `<slug>` = current branch name with `/` replaced by `-`
- Artifacts live in `.review/<slug>/` (gitignored)
- `MAX_ROUNDS` = 3

---

## Round loop

Repeat from round 1. Announce each round to the user with one line before starting it.

### Stage 1 — Triage and context

Spawn `review-context` (Agent tool, `subagent_type: review-context`). Tell it only:

> Build the review context pack for the current branch. This is round `<N>`.

If it reports `PREFLIGHT FAILED`, stop the whole command and relay the reason.

Read `.review/<slug>/context.md` yourself to get the **routing decision**. That decision governs the
rest of the round — do not override it because you think the change deserves more or less scrutiny.

### Stage 2 — Review

レビュアーは**全並列にはできない**。3 軸は同じ作業ツリーを共有しており、そのうち 2 軸が書き込む。

- `reviewer-tests` は変異検証で実装を一時的に壊す
- `reviewer-contract` の `make openapi-check` は `schema.d.ts` を**その場で再生成する**（stale なら
  ファイルが書き換わったまま残る）

全部同時に走らせると、`reviewer-correctness` が変異中のコードを読んで幻の BLOCKER を出し、
`reviewer-tests` の最終 `git status --porcelain` チェックが他人の書き込みで汚れて復元失敗と誤認し、
gradle が同時起動して落ちる。**独立性を作る仕組みが、共有ツリー越しに依存を作り返している。**

したがって 2 段に分ける（routing が名指しした軸だけ、以下の順で）:

1. `reviewer-correctness` と `reviewer-contract` を**並列**（一度に複数 Agent 呼び出し）
2. **返ってきてから** `reviewer-tests` を単独で

Give each one only:

> Review the current branch. Read `.review/<slug>/context.md` and `.review/<slug>/diff.patch` first.
> Write your findings to `.review/<slug>/round<N>/findings-<axis>.md`. This is round `<N>`.

段 1 が返ったら、段 2 に進む前に `git status --porcelain` を自分で確認する。空でなければ
`reviewer-contract` が `schema.d.ts` を再生成したまま返している。`git checkout --` で戻してから
`reviewer-tests` を出す（汚れたツリーで変異検証を始めると復元先が壊れる）。

After they return, verify each expected `findings-*.md` exists. A missing file means that axis
failed — say so in the final report rather than pretending the axis passed.

書き込みが拒否された場合、レビュアーは本文を**返り値として返す**。その場合はオーケストレータが
逐語のまま所定パスに保存する。内容には手を入れない（要約も加筆もしない）。

**そして `reviewer-tests` が返った直後に、もう一度 `git status --porcelain` を確認する。**

```bash
git status --porcelain    # 空でなければ変異が復元されていない
git diff                  # 何が残っているか見る
```

空でなければ `git checkout -- <path>` で戻し、**その事実を最終報告に書く**（復元漏れが起きたこと
自体が `reviewer-tests` のプロンプトの欠陥を示すデータ）。

このチェックを省いてはいけない。復元の担保は `reviewer-tests` の自己申告 1 行しか無く、**復元に
失敗した当人が書く申告**なので検証になっていない。しかも変異検証が finding にするのは定義上
「テストが落ちない変異」＝ `make check` を緑で通り抜ける変異なので、Stage 6 の `make check` も
防波堤にならず、`git add -A` がそのままコミットに吸収する。

### Stage 3 — Verify

Collect every finding block from the findings files. Select which to verify per the routing decision
(all findings, or BLOCKER+MAJOR only, or none).

Spawn one `review-verifier` **per finding**, in parallel, passing the finding block verbatim plus
its id, the branch slug and the round number `<N>` (it writes to `round<N>/verdicts/`). Do not pass
the other findings — each verdict must be independent.

If a round has more than 12 findings to verify, verify the BLOCKER and MAJOR ones first and note in
the report that the rest were not verified. **Say what was skipped**; silent truncation reads as
"everything was checked". Keep the list of skipped findings — Stage 5 counts them.

### Stage 4 — Summarize

Spawn `review-summarizer`:

> Merge round `<N>` for branch `<slug>`. Write `.review/<slug>/round<N>/report.md`.

Read the report yourself.

### Stage 5 — Stop conditions

未解決 BLOCKER+MAJOR の件数は `report.md` の数字だけで数えない。**report.md の未解決 + Stage 3 で
verify を打ち切った BLOCKER/MAJOR + report.md の「検証欠落」に載った BLOCKER/MAJOR** の合計。
`report.md` は verdict の無い finding を採用しないので、この足し戻しをしないと「verify を省いた
BLOCKER が 1 件あるのに収束」と誤報する。

Evaluate in this order:

1. **縮退ルート** — routing decision が「ループなし」なら、Stage 6 の決着だけ行って exit loop。
   未解決が残るならそれは **unresolved** として報告する
2. **収束** — 未解決 BLOCKER = 0 かつ MAJOR = 0 → exit loop, converged
3. **上限** — `N == MAX_ROUNDS` → exit loop, **unresolved**
4. **停滞** — 未解決 BLOCKER+MAJOR の件数が前ラウンドから減っていない → exit loop, **unresolved**

Otherwise continue to Stage 6.

Conditions 3 and 4 are **not success**. Report them as unresolved. Do not describe the run as
complete when findings remain open.

**どの条件で抜けても、抜ける前に Stage 6 の決着だけは必ず行う。** 上限・停滞で抜けるときは修正を
適用しない（もう直さないと決めた回だから）が、残っている BLOCKER/MAJOR を `unresolved` として
`ledger.md` に記録し、`make check` とコミットは飛ばす。

これを省くと、**最も決着の記録が要る回**——直しきれずに止まった回——だけ `ledger.md` が空になる。
CLAUDE.md の「決着は `.review/<slug>/ledger.md` に残る」と最終報告の「却下した指摘と理由」が
そこで破れる。`ledger.md` の outcome は `fixed` / `rejected` / `unresolved` の 3 つ。

### Stage 6 — Fix (you do this yourself)

For every BLOCKER and MAJOR in `report.md`, decide one of two outcomes. Nothing stays undecided.

- **`fixed`** — apply the change.
- **`rejected`** — do not apply it, and write down why. Legitimate reasons: the finding contradicts a
  documented decision in `CLAUDE.md`, the cost outweighs the risk for an MVP, or you judge the
  verifier wrong. "面倒だから" is not a reason.

MINOR and NIT are optional; record whichever you act on.

Append every decision to `.review/<slug>/ledger.md`:

```markdown
## round <N>

| finding | location | severity | outcome | 理由 |
| --- | --- | --- | --- | --- |
| F-correctness-1 | `path:42` | BLOCKER | fixed | <何をしたか 1 行> |
| F-tests-2 | `path:12` | MAJOR | rejected | <なぜ直さないか 1 行> |
```

The `rejected` rows are the **only** thing carried into the next round — `review-context` copies
them into the next context pack so reviewers do not re-litigate settled points. Everything else
resets.

Then run `make check`. It must be green before the next round. If your fixes broke it, fix that
too — re-reviewing a red tree wastes a full round.

**そのあとコミットする。** `make check` が緑になってから、修正を 1 コミットにまとめる:

```bash
git add -A && git commit -m "fix(review): round <N> の指摘に対応"
```

これは任意の後片付けではなく**ループの前提条件**。Stage 1 の `review-context` は preflight で
`git status --porcelain` が空であることを要求する。修正を未コミットのまま Stage 1 に戻ると
ラウンド 2 は必ず `PREFLIGHT FAILED` で死に、**ループが 1 周も回らない**。

`make check` の**後に**コミットすること。`make check` は `openapi-check` 経由で `schema.d.ts` を
再生成するので、先にコミットすると再生成分が漏れる。

コミットは `main...HEAD` に含まれるので、次ラウンドのレビュアーは修正後のコードを見る。これは正しい
（修正そのものが次ラウンドのレビュー対象になる）。ブランチ上のコミットなので `main` には触れない。

Increment `N` and go back to Stage 1.

---

## Final report

Print this to the user directly. Do not paraphrase `report.md`'s findings — quote them.

```markdown
## Review 結果: <branch>

終了理由: 収束 / 上限到達 / 停滞
ラウンド数: <N>

| ラウンド | 生の指摘 | 却下(反証) | 採用 | 未解決 BLOCKER+MAJOR |
| --- | --- | --- | --- | --- |
| 1 | | | | |

### 未解決の指摘
<残っているものを severity 順に。無ければ「なし」>

### 却下した指摘と理由
<ledger の rejected 行>

### 修正した内容
<ラウンドごとに 1 行ずつ>

### 人間レビューが必須か
<migration / auth タグがあれば「必須」と理由。無ければ「通常レビューで可」>
```

Then ask how to proceed: PR を開く / 未解決を直す / 個別に議論する。

**merge は絶対に自動で行わない。** 人間の操作。

---

## Honesty requirements

These matter more than the mechanism:

- 停滞や上限で抜けたら **未解決と報告する**。「レビュー完了」と書かない。
- 軸が失敗した、verdict が欠落した、verify を打ち切った — すべて報告に出す。
- 却下が 0 件、または却下が 8 割超なら、summarizer の所見をそのまま伝える。ハーネス自体が
  ずれているサインで、隠すと直せない。
- レビュアーの指摘は**提案**。BLOCKER でも理由を書いて `rejected` にしてよい。ただし黙って無視しない。
