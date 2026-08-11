# review-harness.md

`/review` の中身。AI 同士でコードレビューを回すための仕組みと、**いつ捨てるべきか**。

## なぜこれがあるか

単一のエージェントに自分の書いたコードをレビューさせても機能しない。生成したモデルは自分の成果を
過大評価する（Anthropic の観測では「明らかに凡庸な品質でも自信満々に称賛する」）。一方、レビュー役を
分けただけでも足りない。評価者は放っておくと浅くテストし、正当な問題も却下する。

そこで 2 つの非対称性を作っている。

1. **生成 ≠ 評価** — レビュアーは fresh context の subagent。書いた側の要約を渡さない。
2. **レビュアーは寛容側、verifier は懐疑側** — レビュアーは網羅的に挙げ、verifier は反証を試み、
   迷ったら却下する。この綱引きが精度を作る。

そしてレビューは**単発ではなくループ**。review → fix → re-review を収束まで回す。

## 構成

```
        ┌──────────────────────────────────────────────┐
        │                                              │
   Triage → Review(×3) → Verify → Summarize → Fix ─────┘
   (context)  (2段)      (1件1体)  (統合)     (メイン)
              └ correctness + contract を並列 → tests を単独
        │                                      │
        └─── 収束 / 上限 3 / 停滞 ─────────────→ 最終報告 → (人間) merge
```

| 段 | 実体 | 役割 |
| --- | --- | --- |
| 1 | `review-context` | 全レビュアーが見る正規化済み入力を作る。**「この変更における正しいの定義」**を書くのが本質 |
| 2 | `reviewer-correctness` / `reviewer-contract` / `reviewer-tests` | 3 つの独立した目的でレビュー。**全並列ではなく 2 段**（理由は「共有する作業ツリーが独立性を壊し返す」の節） |
| 3 | `review-verifier` | finding 1 件につき 1 体。**反証専任**。迷ったら REFUTED |
| 4 | `review-summarizer` | CONFIRMED のみ統合・重複排除・severity 調整 |
| 5 | メインセッション | 各指摘を `fixed` / `rejected(理由)` で決着させ、`ledger.md` に記録 |

## 独立性をどう作っているか

OpenAI の記事は独立性に 3 つのレバー（モデル / 目的 / ツール）を挙げる。このプロジェクトで実際に
効かせているのは後ろ 2 つ + コンテキストの独立性。

| レバー | 状態 |
| --- | --- |
| **目的** | 3 軸で担当を分け、他軸の領分を明示的に out of scope にしている |
| **ツール** | `reviewer-correctness` には **Bash を渡していない**（テストを実行できない = 「通ったから正しい」に逃げられない）。`reviewer-contract` は `make openapi-check` を、`reviewer-tests` は `make test` と変異検証を実行する |
| **コンテキスト** | 全レビュアーが fresh。ラウンド間も引き継がない |
| **モデル** | **得られていない。** 全て Claude Opus。同一ファミリー由来の盲点は残る |

モデル独立性を得るには外部 CLI（`codex` 等）を 1 枚噛ませる必要がある。未導入。差し替えるなら
`reviewer-correctness` を置き換えるのが最も効果が高い（最も判断が主観的な軸のため）。

**Opus と Sonnet を混ぜても独立性にはならない**（同一ファミリー）。品質のために組む仕組みで
弱いモデルを使う理由は無いので、全段 Opus に統一している。

## 共有する作業ツリーが独立性を壊し返す

レビュアーの**コンテキスト**は独立しているが、**作業ツリーは 1 つ**で、3 軸のうち 2 軸が書き込む。

| 軸 | 何を書くか |
| --- | --- |
| `reviewer-tests` | 変異検証で実装を一時的に壊す |
| `reviewer-contract` | `make openapi-check` が `schema.d.ts` を**その場で再生成する**（stale なら書き換わったまま残る） |
| `reviewer-correctness` | 書かない（Bash 無し） |

3 つ同時に走らせると、独立しているはずの軸が共有ツリー越しに干渉する:

- `reviewer-correctness` が変異中のコードを読み、幻の BLOCKER を出す
- `reviewer-tests` の最終 `git status --porcelain` が `reviewer-contract` の書き込みで汚れ、
  自分の復元が失敗したと誤認する
- gradle が同時に起動して落ちる。ツール由来の失敗が finding の evidence に化ける

そこで Stage 2 は 2 段に分けている。**`correctness` + `contract` を並列 → 返ってから `tests` を単独。**

並列度が落ちるのは意図的なコスト。**書き込む軸を隔離する方が、1 ラウンドを速く回すより価値がある**
（幻の指摘を 1 件でも通すと verify に 1 体、修正判断に 1 往復かかる）。

git worktree で `reviewer-tests` を隔離すれば並列に戻せるが、`.review/` は gitignore されており
新しい worktree には存在しないので、context pack を読ませる経路を別に作る必要がある。
**それだけの複雑さを払う価値が出るまで直列でよい。**

## ループ制御

停止条件は 3 つ。

| 条件 | 意味 | 報告 |
| --- | --- | --- |
| 収束 | 未解決 BLOCKER = 0 かつ MAJOR = 0 | 完了 |
| 上限 | ラウンド 3 に到達 | **未解決** |
| 停滞 | 未解決件数が前ラウンドから減っていない | **未解決** |

上限・停滞で抜けた場合を「完了」と報告しないこと。直せない指摘を延々と直そうとするのを止めるのが
停滞検出の役目で、止まったこと自体は失敗ではない。

### ラウンド間で修正をコミットする理由

Stage 6 の修正は、`make check` が緑になった時点で**コミットしてから**次ラウンドに入る。

後片付けではなく前提条件。`review-context` の preflight は `git status --porcelain` が空であることを
要求するので、修正を未コミットのまま Stage 1 に戻るとラウンド 2 は必ず `PREFLIGHT FAILED` で死ぬ。
**ループが 1 周も回らない。**

コミットは `main...HEAD` に入るので、次ラウンドのレビュアーは修正後のコードを見る。これは正しい
挙動で、**修正そのものが次ラウンドのレビュー対象になる**。ブランチ上の操作なので `main` には触れない。

### ラウンド間で引き継ぐのは却下台帳だけ

次ラウンドのレビュアーは前ラウンドの findings も report も見ない。同じ問題が独立に再検出されたら、
それは**指摘が強い証拠**として扱う。

唯一の例外が `ledger.md` の `rejected` エントリ。これだけを次の context pack に載せ、
「**新しい根拠がある場合のみ再提起せよ**」と指示する。これが無いと同じ指摘を毎ラウンド蒸し返して
永久に収束しない。人間のレビューで resolved なスレッドが畳まれているのと同じ扱い。

## 成果物

`.review/<branch>/`（gitignore 済み）:

```
context.md              入力契約。全レビュアーがこれを見る
diff.patch              Bash を持たない reviewer-correctness 用
round<N>/findings-*.md  各軸の生の指摘
round<N>/verdicts/*.md  1 finding 1 判定
round<N>/report.md      統合結果 + キャリブレーション節
ledger.md               全 finding の最終状態（fixed / rejected + 理由）
```

git に入れないのは、PR の diff を汚さないためと、**`git status` をクリーンに保つため**。
レビュアー自身が作業ツリーの状態を見るので、汚れていると判断を誤る。

## チューニング

`report.md` の「反証で却下された指摘」がプロンプト調整の入力。

| 症状 | 直す場所 |
| --- | --- |
| 却下が 0 件 | `review-verifier` が寛容すぎる。反証の要求を強める |
| 却下が 8 割超 | レビュアーが雑。out-of-scope リストか few-shot を足す |
| 特定のバグを毎回見逃す | その軸の「What you look for」に項目を足し、few-shot に採用例として書く |
| フォーマット等を毎回指摘する | その軸の out-of-scope リストに足す |

`summarizer` は上 2 つに該当したとき報告の末尾に所見を出す。

## いつ捨てるか

Anthropic の記事の核心:

> every component in a harness encodes an assumption about what the model can't do on its own

各エージェント定義の冒頭に `Assumes:` / `Delete when:` を書いてある。モデルが良くなったら、
仮定が成り立たなくなった順に**消す**。増やし続けるものではない。

削除される順の予想:

1. **`review-verifier`（Stage 3）** — レビュアーの指摘が十分正確になれば不要。最初に消える候補
2. **`review-summarizer`（Stage 4）** — 軸を 1 つに減らせば不要
3. **3 軸 → 1 軸** — 単一レビュアーで抜けが無くなれば統合
4. **ループ** — 1 回のレビューで収束するなら不要

逆に、**このハーネス全体が MVP の速度を落としていると感じたら、迷わず縮退ルートを広げる**か、
使うのを `migration` / `auth` を含む PR だけに限定してよい。フルで回すと 1 ラウンドあたり
5〜15 エージェント、3 ラウンドで 30 超になる。Anthropic の実測でもフルハーネスは単一エージェント比で
約 20 倍のコスト。**最も単純な解から始め、必要になったときだけ複雑さを増やす。**

## 既存の仕組みとの関係

- `make check` が捕まえるもの（Spotless / ESLint / Prettier / tsc / OpenApiSnapshotTest）は
  全レビュアーで out of scope。二重に指摘するとノイズになる。
- Claude Code 組み込みの `/security-review` とは重複させない。認証・秘密情報・SQL 構築・外部連携に
  触れた PR では、こちらのレビューとは別に実行する。
- CI では動かさない。ローカルの `/review` のみ（API 課金を発生させないため）。
  したがって**実行を強制する仕組みが無い**。PR を開く前に自分で回すこと。
