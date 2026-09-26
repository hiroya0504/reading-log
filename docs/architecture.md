# architecture.md

reading-log の全体像。MVP 期間中は短く保つ。

## 俯瞰

```
[ Next.js (App Router) ]
   src/lib/api/client.ts  ← 型付きクライアント（唯一の API 入口）
        ↓ fetch (Basic 認証)
[ Spring Boot REST API ]
   - Controller (HTTP)
   - Service    (business / @Transactional)
   - Mapper     (MyBatis SQL)
        ↓ JDBC
[ PostgreSQL ]   ホスト側 5433（photo-management と共存させるため）
   ↑ Flyway migrations
```

## API 契約ハーネス

FE/BE を往復する開発でズレを機械的に検出するための仕組み。**このプロジェクトで最初に入れた唯一の非自明なハーネス**。

| 層 | 実体 | 落ちるタイミング |
| --- | --- | --- |
| BE 契約の固定 | `OpenApiSnapshotTest` | Controller/DTO を変えて `docs/openapi.json` を更新し忘れると `make test` で失敗 |
| FE 型の生成 | `openapi-typescript` → `frontend/src/lib/api/schema.d.ts` | 契約を更新して FE が古いフィールドを使っていると `pnpm typecheck` で失敗 |
| 生成物の鮮度 | `make openapi-check` | 生成物がコミットされていないと CI で失敗 |

`springdoc-openapi-gradle-plugin` は採用しなかった。`bootRun` を起こす必要があり実 DB に依存して CI で不安定になるため、既存の Testcontainers 基盤に乗る JUnit テスト 1 本で代替している。

## 認証（Basic、差し替え可能な形で）

ローカル検証のみのため HTTP Basic。ただし**後で JWT / OAuth に差し替えられる形**を最初から守る。

1. `users` テーブルを最初から持ち、ユーザー所有データに `user_id` FK を張る
   → 多ユーザー化のときに破壊的マイグレーションが不要になる。**後付けが最も高くつくのはここ**。
2. アプリコードは `CurrentUser` port からしか acting user を取らない
   → 差し替え時に変わるのは `BasicAuthCurrentUser` 1 クラスだけ。
3. `SecurityConfig` は認証方式の設定を `SecurityFilterChain` Bean 1 つに閉じ込める
   → 将来 JWT チェーンを並べて追加できる。
4. FE の認証ヘッダ付与は `src/lib/api/client.ts` 1 箇所だけ。

`spring.security.user.name/password`（プロパティ直書き）は**使わない**。DB にユーザー行が存在しなくなるため。

## エラー契約（RFC 9457 ProblemDetails）

- すべての例外を `application/problem+json` に統一。
- `DomainException`（抽象）→ `NotFoundException` / `ValidationException` / `ConflictException` / `ForbiddenException`。
- 変換は `common/error/ProblemDetailsAdvice`。拡張フィールドは `errorCode`。
- Bean Validation 失敗時は `errors[]` に `{field, message}` を含める。

## DB / マイグレーション

- PostgreSQL 16。Flyway（`backend/src/main/resources/db/migration/V{n}__xxx.sql`）。
- **適用済みファイルの編集禁止**。修正は `V{n+1}` を追加。
- スキーマ整合性は Testcontainers（実 PostgreSQL）で担保。

## CI

- `.github/workflows/ci.yml` の 1 ファイル / 2 ジョブ（`backend` / `frontend`）。これがブランチ保護の必須コンテキスト。
- 各ステップは `make` を呼ぶ。**コマンドの正は Makefile 一本**で、CI との二重管理をしない。
- `concurrency` で古いジョブをキャンセル、`permissions: contents: read` で GITHUB_TOKEN を最小権限に。

### ブランチ保護

classic branch protection ではなく **repository ruleset**（名前 `main`）で設定している。

- 対象: `refs/heads/main`
- ルール: PR 必須 / 必須ステータスチェック `backend`・`frontend` / ブランチ削除禁止 / force push 禁止
- bypass actor なし（管理者も迂回できない）

確認コマンド:

```bash
gh api repos/<owner>/reading-log/rules/branches/main --jq '.[].type'
```

**空配列が返ったら保護は効いていない。** ruleset が `active` でも `conditions.ref_name.include` が空だと対象ブランチがゼロ件になり、設定画面上は正しく見えるのに何も保護されない状態になる。ruleset の存在ではなく、このエンドポイントの出力で判断すること。

## 外部 API（Google Books）

本の検索（`GET /api/book-search`）は backend の `booksearch` パッケージのポート（`BookCatalog`）を通して Google Books API を呼ぶ。呼び出す client は `repository/http/googlebooks/GoogleBooksClient`（外部 API の置き場所の規約は `backend/CLAUDE.md`）。frontend は Google を直接呼ばない（キーをブラウザに出さず、応答の形を OpenAPI の契約に載せるため）。

- **API キーが実質必須。** キーなしのリクエストは全利用者で共有する枠に数えられ、ほぼ常に 1 日の上限に達している（429）。
  Books API は無料で、課金アカウントも要らない（1 プロジェクトあたり 1 日およそ 1,000 リクエスト）。
- キーは `backend/.env` に `GOOGLE_BOOKS_API_KEY=...` と書く。`.gitignore` で除外済みで、`application.yml` の `spring.config.import` が起動時に読む。ファイルが無ければキーなしで動く。
- 上限超過（429）は `503 BOOK_SEARCH_QUOTA_EXCEEDED`、それ以外の失敗は `502 BOOK_SEARCH_UNAVAILABLE` として返す。
- 表紙は画像の URL だけを `books.cover_url` に持つ（画像そのものは保存しない）。受け付けるのは `https://books.google.com/` と `https://books.googleusercontent.com/` だけ。
- テストは Google に繋がない。`FakeGoogleBooks`（JDK の `HttpServer`）を立てて向ける。

## MVP のマイルストーン

| M | 内容 |
| --- | --- |
| M1 | 本の CRUD |
| M2 | 読書ステータスと進捗 |
| M3 | 評価と感想 |
| M4 | タグと検索 |
| M5（任意） | Google Books 連携 |
