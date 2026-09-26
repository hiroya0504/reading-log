# AIレビュー 共通の前提

すべての検出役（規約準拠・セキュリティ・テスト）と検証役が読む。

## 対象外（他のツールや人間に任せるもの）

次の観点は、どの検出役も指摘しない。検証役は、これに当たる指摘を DROP にする。

| 観点 | 担当 |
| --- | --- |
| フォーマット（インデント、改行、import 順、未使用 import） | Spotless（`make lint-backend`） |
| 命名 | 人間のレビュー。`backend/CLAUDE.md` の命名規約 |
| レイヤ依存（Controller → Service → Mapper の方向、acting user の渡し方） | 人間のレビュー。ArchUnit は MVP 期間中は導入しない（`CLAUDE.md`） |
| テストの成否、カバレッジの数値 | `make test-backend`（CI の static-checks ジョブ） |
| API 契約と `docs/openapi.json` のずれ | `OpenApiSnapshotTest` |
| パフォーマンス | MVP 期間中はやらない（`CLAUDE.md`） |

## 共通の原則

1. **「かもしれない」だけの指摘は出さない。** 問題が起きる具体的な経路（どの呼び出しで、どの値のとき、何が起きるか）をコードで示せるものだけを出す。
2. **修正案は具体的に示す。** 「見直してください」「検討してください」ではなく、何をどう変えるかを書く。
3. **変更された行だけを指摘する。** 差分に含まれない既存コードの問題は出さない。
4. **一般的なベストプラクティス、好み、リファクタリング提案は出さない。** 正しくても出さない。

## 観点と ID

| 観点 | 検出役 | 指摘の `rule_id` |
| --- | --- | --- |
| 規約準拠 | `review-detector-rules` | `rules.md` のルール ID（`DEF-001` など） |
| セキュリティ | `review-detector-security` | `SECURITY` |
| テスト | `review-detector-tests` | `TESTS` |
