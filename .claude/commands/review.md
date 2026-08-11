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

Spawn the reviewers the routing decision names, **in parallel** (one message, multiple Agent calls).
Give each one only:

> Review the current branch. Read `.review/<slug>/context.md` and `.review/<slug>/diff.patch` first.
> Write your findings to `.review/<slug>/round<N>/findings-<axis>.md`. This is round `<N>`.

After they return, verify each expected `findings-*.md` exists. A missing file means that axis
failed — say so in the final report rather than pretending the axis passed.

### Stage 3 — Verify

Collect every finding block from the findings files. Select which to verify per the routing decision
(all findings, or BLOCKER+MAJOR only, or none).

Spawn one `review-verifier` **per finding**, in parallel, passing the finding block verbatim plus
its id and the branch slug. Do not pass the other findings — each verdict must be independent.

If a round has more than 12 findings to verify, verify the BLOCKER and MAJOR ones first and note in
the report that the rest were not verified. **Say what was skipped**; silent truncation reads as
"everything was checked".

### Stage 4 — Summarize

Spawn `review-summarizer`:

> Merge round `<N>` for branch `<slug>`. Write `.review/<slug>/round<N>/report.md`.

Read the report yourself.

### Stage 5 — Stop conditions

Evaluate in this order:

1. **収束** — 未解決 BLOCKER = 0 かつ MAJOR = 0 → exit loop, converged
2. **上限** — `N == MAX_ROUNDS` → exit loop, **unresolved**
3. **停滞** — 未解決 BLOCKER+MAJOR の件数が前ラウンドから減っていない → exit loop, **unresolved**

Otherwise continue to Stage 6.

Conditions 2 and 3 are **not success**. Report them as unresolved. Do not describe the run as
complete when findings remain open.

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
