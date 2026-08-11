---
description: 現在のブランチでマルチエージェントのレビューループを回す。独立したレビュアー、反証パス、そして修正と再レビューを収束まで繰り返す。
---

現在のブランチを `main` と比較してレビューハーネスを回す。

君は**オーケストレータであり、修正する側**。このコードを書いたのは君なので、**レビューしてはいけない**。
それがレビュアー subagent の役割であり、その価値は君の文脈を共有していないことだけから来ている。

**subagent に変更の要約を渡さない。** 何を意図したか、どこが危ないと思うか、どのファイルが重要かを
伝えない。彼らは `.review/<slug>/context.md` とリポジトリを読む。**枠をはめることが、このハーネスが
静かに機能しなくなる経路**。

仕組みと各段の理由は `docs/review-harness.md` にある。

---

## 定義

- `<slug>` = 現在のブランチ名の `/` を `-` に置換したもの
- 成果物は `.review/<slug>/` に置く（gitignore 済み）
- `MAX_ROUNDS` = 3

---

## ラウンドループ

ラウンド 1 から繰り返す。各ラウンドの開始前に、1 行でユーザーに知らせる。

### Stage 1 — 仕分けとコンテキスト

`review-context` を起動する（Agent ツール、`subagent_type: review-context`）。渡すのは次の 1 文だけ。

> 現在のブランチのレビューコンテキストパックを作れ。これはラウンド `<N>`。

`PREFLIGHT FAILED` が返ったら、コマンド全体を停止して理由をそのまま伝える。

`.review/<slug>/context.md` を**自分で読み**、**ルーティング決定**を把握する。その決定がこのラウンド
全体を支配する。**もっと厳しく／緩く見るべきだと思っても override しない。**

### Stage 2 — レビュー

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

各レビュアーに渡すのは次の 2 文だけ。

> 現在のブランチをレビューせよ。まず `.review/<slug>/context.md` と `.review/<slug>/diff.patch` を読むこと。
> findings は `.review/<slug>/round<N>/findings-<axis>.md` に書く。これはラウンド `<N>`。

段 1 が返ったら、段 2 に進む前に `git status --porcelain` を自分で確認する。空でなければ
`reviewer-contract` が `schema.d.ts` を再生成したまま返している。`git checkout --` で戻してから
`reviewer-tests` を出す（汚れたツリーで変異検証を始めると復元先が壊れる）。

返ってきたら、期待される `findings-*.md` が揃っているか確認する。**ファイルが無い軸は失敗した軸**。
その軸が通ったふりをせず、最終報告にそう書く。

書き込みが拒否された場合、レビュアーは本文を**返り値として返す**。その場合はオーケストレータが
逐語のまま所定パスに保存する。内容には手を入れない（要約も加筆もしない）。

**そして `reviewer-tests` が返った直後に、もう一度 `git status --porcelain` を確認する。**

```bash
git status --porcelain    # 空でなければ変異が復元されていない
git diff                  # 追跡済みファイルに何が残っているか
```

空でなければ戻し、**その事実を最終報告に書く**（復元漏れが起きたこと自体が `reviewer-tests` の
プロンプトの欠陥を示すデータ）。

戻し方は残骸の種類で違う。`git status --porcelain` は未追跡ファイル（`??`）も出すが、
`git checkout --` は**追跡済みファイルの変更しか戻さない**。

- 追跡済みの変更（`M`）→ `git checkout -- <path>`
- 未追跡の残骸（`??`）→ 中身を見てから消す。`.review/` 配下なら成果物なので残す（gitignore 済みで
  `git status` には出ない）

未追跡ファイルを `git checkout --` で戻そうとして status が空にならないまま進むと、次ラウンドの
preflight が `PREFLIGHT FAILED` で落ちる。**消す前に必ず中身を見る。**

このチェックを省いてはいけない。復元の担保は `reviewer-tests` の自己申告 1 行しか無く、**復元に
失敗した当人が書く申告**なので検証になっていない。しかも変異検証が finding にするのは定義上
「テストが落ちない変異」＝ `make check` を緑で通り抜ける変異なので、Stage 6 の `make check` も
防波堤にならず、`git add -A` がそのままコミットに吸収する。

### Stage 3 — 反証

findings ファイルから finding ブロックを全て集める。どれを verify するかはルーティング決定に従う
（全件 / BLOCKER・MAJOR のみ / なし）。

`review-verifier` を **finding 1 件につき 1 体**、並列で起動する。渡すのは finding ブロックの逐語と、
その id、ブランチ slug、ラウンド番号 `<N>`（`round<N>/verdicts/` に書くため）。**他の finding は
渡さない** — 各判定は独立していなければならない。

verify 対象が 12 件を超えるラウンドでは、BLOCKER と MAJOR を先に verify し、残りを verify しなかった
ことを報告に明記する。**何を省いたかを言うこと。** 黙って打ち切ると「全部確認した」と読まれる。
打ち切った finding のリストは保持しておく — Stage 5 で数える。

### Stage 4 — 統合

`review-summarizer` を起動する。

> ブランチ `<slug>` のラウンド `<N>` を統合せよ。`.review/<slug>/round<N>/report.md` に書く。

出てきた報告は**自分で読む**。

### Stage 5 — 停止条件

未解決 BLOCKER+MAJOR の件数は `report.md` の「このラウンドの判定」の数字だけで数えない。
**その数字 + report.md の「検証欠落」に載った BLOCKER/MAJOR** の合計。`report.md` は verdict の
無い finding を採用しないので、この足し戻しをしないと「verify を省いた BLOCKER が 1 件あるのに
収束」と誤報する。

Stage 3 で打ち切った分を別途足さないこと。**打ち切られた finding は verdict を持たないので、
必ず「検証欠落」に載る**（`review-summarizer` の規則）。両方足すと同じ件を二重に数え、実際には
減っているラウンドを停滞と誤判定する。打ち切った件のリストは、報告に「何を verify しなかったか」
を書くために保持する。

severity は verdict の修正案が反映された後の値で数える。**未解決 0 は「直した」を意味しない** —
verifier が MAJOR を MINOR に引き下げた結果でも 0 になる。最終報告ではどちらの経路かを書く。

以下の順に評価する。

1. **縮退ルート** — routing decision が「ループなし」なら、Stage 6 の決着だけ行って exit loop。
   未解決が残るならそれは **unresolved** として報告する
2. **収束** — 未解決 BLOCKER = 0 かつ MAJOR = 0 → exit loop, converged
3. **上限** — `N == MAX_ROUNDS` → exit loop, **unresolved**
4. **停滞** — 未解決 BLOCKER+MAJOR の件数が前ラウンドから減っていない → exit loop, **unresolved**

いずれにも当たらなければ Stage 6 へ進む。

**条件 3 と 4 は成功ではない。** 未解決として報告する。指摘が開いたままの実行を「完了」と書かない。

**どの条件で抜けても、抜ける前に Stage 6 の決着だけは必ず行う。** 上限・停滞で抜けるときは修正を
適用しない（もう直さないと決めた回だから）が、残っている BLOCKER/MAJOR を `unresolved` として
`ledger.md` に記録し、`make check` とコミットは飛ばす。

これを省くと、**最も決着の記録が要る回**——直しきれずに止まった回——だけ `ledger.md` が空になる。
CLAUDE.md の「決着は `.review/<slug>/ledger.md` に残る」と最終報告の「却下した指摘と理由」が
そこで破れる。`ledger.md` の outcome は `fixed` / `rejected` / `unresolved` の 3 つ。

### Stage 6 — 修正（これは君自身がやる）

`report.md` の BLOCKER と MAJOR すべてについて、2 つの結末のどちらかを決める。**未決着を残さない。**

- **`fixed`** — 変更を適用する。
- **`rejected`** — 適用せず、理由を書く。正当な理由は、指摘が `CLAUDE.md` に文書化された決定と
  矛盾する、MVP としてコストがリスクに見合わない、verifier の判断が誤っていると考える、のいずれか。
  **「面倒だから」は理由ではない。**

MINOR と NIT は任意。対処したものだけ記録する。

決定はすべて `.review/<slug>/ledger.md` に追記する。

```markdown
## round <N>

| finding | location | severity | outcome | 理由 |
| --- | --- | --- | --- | --- |
| F-correctness-1 | `path:42` | BLOCKER | fixed | <何をしたか 1 行> |
| F-tests-2 | `path:12` | MAJOR | rejected | <なぜ直さないか 1 行> |
```

次のラウンドへ持ち越されるのは `rejected` の行**だけ**。`review-context` がそれを次のコンテキスト
パックに転記し、レビュアーが決着済みの点を蒸し返さないようにする。それ以外は全てリセットされる。

次に `make check` を実行する。**次のラウンドに入る前に緑でなければならない。** 修正で壊したなら
それも直す。赤いツリーを再レビューするのは 1 ラウンドの無駄。

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

`N` を 1 増やして Stage 1 に戻る。

---

## 最終報告

これをユーザーに直接出力する。`report.md` の指摘を**言い換えず、引用する**。

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

そのうえで、どう進めるかを尋ねる: PR を開く / 未解決を直す / 個別に議論する。

**merge は絶対に自動で行わない。** 人間の操作。

---

## 誠実さの要件

**仕組みそのものより、こちらの方が重要。**

- 停滞や上限で抜けたら **未解決と報告する**。「レビュー完了」と書かない。
- 軸が失敗した、verdict が欠落した、verify を打ち切った — すべて報告に出す。
- 却下が 0 件、または却下が 8 割超なら、summarizer の所見をそのまま伝える。ハーネス自体が
  ずれているサインで、隠すと直せない。
- レビュアーの指摘は**提案**。BLOCKER でも理由を書いて `rejected` にしてよい。ただし黙って無視しない。
