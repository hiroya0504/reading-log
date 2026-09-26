# AI レビュー

Claude Code による 2 段構成（検出→検証）のコードレビュー。ローカル（Skill）と GitHub Actions で、同じ `.claude/` の定義を共有する。
検出役は観点ごとに分かれている（規約準拠・セキュリティ・テスト）。検証役は全観点で共通。

## 設計方針

1. **網羅性より精度を優先する。** 誤指摘が続くと、人は AI レビューを読まなくなる。検出の後に検証を挟み、迷ったら出さない。
2. **決定的にできることは AI にやらせない。**
   - フォーマットは Spotless、テストの成否は `make test-backend` に任せる。
   - コメントの書式、件数の上限、投稿は `post-review.js` が行う。
   - レイヤ依存は ArchUnit に任せたいが、MVP 期間中は導入しない（`CLAUDE.md`）。当面は人間が見る。
3. **ルール単位で効果を測って改善する。** 指摘にルール ID（ルール外の観点は観点 ID）を埋め込み、ID ごとに「取り込まれたか」を集計する。

## 観点

| 観点 | 検出役 | 判定の基準 | 対象 | 指摘の ID |
| --- | --- | --- | --- | --- |
| 規約準拠 | `review-detector-rules` | `rules.md` のルールだけ | 本体の `.java` | `DEF-001` などのルール ID |
| セキュリティ | `review-detector-security` | 基準文書なし。エージェント定義の観点の説明 | 本体の `.java` | `SECURITY` |
| テスト | `review-detector-tests` | 基準文書なし。エージェント定義の観点の説明 | 本体とテストの `.java` | `TESTS` |

- `rules.md` に基づいてレビューするのは規約準拠の検出役だけ。セキュリティとテストは、ルールに書いていない問題も拾う。
- 全観点に共通の「対象外」と原則（「かもしれない」だけの指摘は出さない、など）は `common.md` にある。
- **ルール外の観点は、規約準拠より誤指摘が出やすい。** 検証役が照合できる基準文書が無く、コードで事実と経路を確かめるだけになるため。`review_metrics.py` の 👎 を見て、多ければ基準文書を作るか、よく出る指摘をルールに昇格させる。
- 観点をまたいだ指摘は統合しない。同じ行に複数の観点のコメントが付くことがある。観点が違えば、同じ行でも中身は別の問題であることが多いため（PR #12 で、統合によって正しいテストの指摘が 2 件消えた）。
  そのため、SEC-001 と `SECURITY` が同じ `${}` を指すような重複は起こりうる。
- 同じ観点・同じファイルの指摘は 1 件にまとめ、他の該当行を本文に追記する。サマリの件数は「検出 → 検証通過（統合後、インライン）」の順に出す。

## 構成

```
.claude/
├── agents/review-detector-rules.md    検出役（規約準拠）
├── agents/review-detector-security.md 検出役（セキュリティ）
├── agents/review-detector-tests.md    検出役（テスト）
├── agents/review-verifier.md          検証役。全観点共通。1 件ずつ KEEP / DROP を判定する（迷ったら DROP）
├── skills/ai-review/SKILL.md          司令塔の手順。自分ではレビューしない
├── skills/ai-review/references/common.md  全観点に共通の「対象外」と原則
├── skills/ai-review/references/rules.md   規約準拠のルール定義
└── settings.json                      ローカルで git diff / git show / gh pr diff を許可
.github/
├── workflows/ai-review.yml
├── ai-review-schema.json              Claude の最終出力の JSON スキーマ
└── scripts/post-review.js (+ .test.js)    PR への投稿
scripts/review_metrics.py              ルール別の集計
```

```
resolve ─▶ static-checks ─▶ ai-review ─▶ post-review
 PR の特定   Spotless          Claude        post-review.js（投稿）
 と権限確認  + テスト          読み取り専用    + ai-reviewed ラベルの付与
                                │
                                ├─ review-detector-{rules,security,tests} ×(観点 × 8 ファイルごと)
                                ├─ review-verifier ×(指摘ごと)
                                └─ 集約 → {detected_count, verified_count, failed_groups, findings[]}
```

- 対象は `backend/src/main/java/` 配下の `.java`（テストの観点だけ `backend/src/test/java/` も）。フロントエンドは対象外。
- Claude が動くジョブには、PR への書き込み権限を渡さない（`pull-requests: read`）。投稿は別ジョブの `post-review.js` が行う。
- モデルは固定している（下の「モデルの選定」）。既定のモデルは勝手に変わり、ルール別の効果測定の前後比較が崩れるため。変えるときは、変えた日付を記録して比較から外す。
- 検出役が差分を取得できなかったなどで失敗したグループがあると、`failed_groups` が 1 以上になる。そのときは「指摘なし」とは書かず、不完全なレビューである旨をサマリに出したうえで、ジョブを失敗にする。
- `.claude/`、スキーマ、投稿スクリプトは**ベースブランチの内容**で上書きしてから使う。PR の中でルールを緩めても、その PR 自身のレビューには効かない。ベースにまだ無い場合（導入 PR など）は、PR ブランチの内容を使う。

## 使い方

### ローカル

Claude Code で `/ai-review`、または「PR 出す前に見て」と頼む。`origin/main...HEAD` の差分と未コミット分を見て、結果を画面に表示する。どこにも投稿しない。

### CI

PR に `/ai-review` とコメントしたときだけ走る。PR の作成や push では走らない。

| 条件 | 内容 |
| --- | --- |
| コメント | 1 行目がちょうど `/ai-review`（末尾の空白と、2 行目以降の文は構わない）。`/ai-reviewer` や文中の `/ai-review` では走らない |
| コメントした人 | 書き込み権限のある人（OWNER / MEMBER / COLLABORATOR）だけ。`issue_comment` は Secret を使える状態で動くため |
| PR | open のもの。ドラフトも対象。fork からの PR は対象外（他人のコードを Secret のある環境で動かさないため） |

- 同じ PR で続けて `/ai-review` とコメントすると、古い実行はキャンセルされる。
- `static-checks`（Spotless とテスト）が落ちた場合は、AI レビューを実行しない。
- レビューを投稿できたら、PR に **`ai-reviewed` ラベル**を付ける。検出の一部が失敗して「不完全」と投稿した場合も付ける。ラベルは次の `/ai-review` でも付いたまま。
- `issue_comment` のワークフローは、**デフォルトブランチ（`main`）にある版**で動く。ワークフローの変更は、マージするまで反映されない。PR の中で試すことはできない。

### 投稿の形

- 差分内の指摘は、重要度順に**最大 5 件**をインラインコメントにする。指摘 1 件につき 1 スレッド。
- 差分外の指摘と、上限を超えた分はレビュー本文（サマリ）に書く。差分外の行にインラインコメントを付けると、レビュー全体が 422 で失敗するため。
- すべてを 1 回のレビュー（`COMMENT`）で投稿するので、通知は 1 回。
- インラインコメントのフッターのリアクションで評価してほしい。

  | リアクション | 意味 |
  | --- | --- |
  | 👍 | 対応した |
  | 👎 | 誤り |
  | 😕 | 正しいが不要 |

## モデルの選定

| 役割 | モデル | 設定場所 |
| --- | --- | --- |
| 司令塔 | `claude-sonnet-5` | `ai-review.yml` の `--model` |
| 検出役（3 観点とも） | `claude-opus-5-5` | `.claude/agents/review-detector-*.md` の `model` |
| 検証役 | `claude-opus-5-5` | `.claude/agents/review-verifier.md` の `model` |

- 司令塔は呼び分けと集約をするだけなので Sonnet で足りる。
- 検証役は誤指摘を落とす精度の要なので Opus。
- 検出役は当初 Sonnet にしていた（多めに拾えばよく、誤指摘は検証役が落とすため）。しかし、検証役は**見落としを拾い直せない**ので、見落としの責任は検出役だけが負う。比較の結果、Opus にした。

2026-09-26 の比較（PR #11。本物の違反 7 件、きわどいケース 3 件を仕込んだ差分）:

| 検出役 | 回数 | 本物の違反の検出 | きわどいケースの誤検出 | 1 回あたりの費用換算 | 時間 |
| --- | --- | --- | --- | --- | --- |
| Sonnet | 2 | 6/7、7/7 | 0 | $1.09〜1.17 | 約 240 秒 |
| Opus | 3 | 7/7、7/7、7/7 | 0 | $0.90〜1.04 | 110〜240 秒 |

Opus は単価が高いが、少ない手数で答えにたどり着くため、全体の費用はむしろ下がった。試行回数が少ないので傾向として扱う。
この比較は観点を分ける前（検出役 1 体）のもの。観点を 3 つに分けたので、検出役の費用はおよそ 3 倍になる見込み。

## ルールの追加・変更

`rules.md` を編集する。各ルールには、ID・重要度・「指摘すること」・「指摘しないこと」を必ず書く。誤検出の多くは「指摘しないこと」で防ぐ。
ルール外の観点（`SECURITY` / `TESTS`）でよく出る指摘は、ルールに昇格させると、検証役が照合できるようになり精度が上がる。

- 初期ルールは DEF-001（`@Transactional` の自己呼び出し）、DEF-002（例外の握りつぶし）、SEC-001（MyBatis の `${}`）の 3 つ。
- PERF 次元は、MVP 期間中はルールを置かない。
- ルールを変えた PR のレビューには、変更前のルールが使われる（上記の上書きのため）。
- サマリの先頭に `<!-- ai-review:summary rules=<SHA> -->` が入る。SHA は `.claude/` が最後に変わったコミットで、ルールやエージェント定義の変更前後で効果を比べられる。

## 効果の測定

```bash
python3 scripts/review_metrics.py --since 2026-09-01
```

ルールごとに、件数、outdated 率、resolved 率、👍 / 👎 / 😕 の数を出す。件数が少ないルールは参考値として表示する。

| 傾向 | 対応 |
| --- | --- |
| 👎 が多い | 検証役が落とすべきものを通している。`rules.md` の「指摘しないこと」を見直す |
| 😕 が多い、または outdated 率が低い | 当たっていても直されていない。ルールの削除を検討する |
| outdated 率が高い | 機械的に直せている。静的解析への移行を検討する |

outdated は、行が変更されたことを示すだけで、指摘を受けて直したことの証明ではない（rebase でも outdated になる）。

## セットアップ

1. Claude Code で `/install-github-app` を実行する。Claude GitHub App がインストールされ、Secrets に `CLAUDE_CODE_OAUTH_TOKEN` が登録される。
   - このワークフローは `github_token` に `GITHUB_TOKEN` を渡しているので、App そのものが無くても動く。必要なのはトークンの Secret。
   - API キーの従量課金にする場合は、`ANTHROPIC_API_KEY` を登録し、`ai-review.yml` のコメントに従って差し替える。
   - インストーラーは `claude.yml`（@claude で呼ぶ汎用アシスタント）と `claude-code-review.yml`（全 PR の自動レビュー）を追加するブランチも作る。**`claude-code-review.yml` はこの AI レビューと役割が重なるので入れない。**
2. `ai-reviewed` ラベルを作る（**作成済み**）。消した場合は `gh label create ai-reviewed` で作り直す。
3. 推奨: `CODEOWNERS` で `.claude/` と `.github/` を保護する。上書きの仕組みは「その PR 自身」にしか効かないため、ルールの変更そのものは人間がレビューする必要がある。

Bedrock / Vertex AI に切り替える場合は、`ai-review.yml` のコメントを参照。

## 将来の拡張（今回はやらない）

- `original_commit_id` とマージ時点のファイルを比較した、行単位での「直したか」の判定
- 週次の集計ワークフロー（`schedule` トリガー）と、結果の CSV への蓄積
- 人間のレビューコメントを基準線にした比較
- フロントエンド（TypeScript）への対象拡大（テストコードは、テストの観点で対象にしている）
