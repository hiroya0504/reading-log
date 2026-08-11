# backend/CLAUDE.md

Spring Boot 3.5 / Java 21 / MyBatis / Flyway / PostgreSQL。

**短く保つこと**（トップ `CLAUDE.md` と合わせて毎回コンテキストを食う）。

---

## パッケージ構造（Package-by-Feature）

```
com.example.readinglog/
├── ReadingLogApplication.java
├── common/error/     ProblemDetails 一式
├── common/security/  CurrentUser port + Basic 実装
├── config/           Spring の Config クラスのみ
├── health/           /api/health
├── user/             users テーブル / UserDetailsService
└── book/             MVP の本体
```

新しい機能は新パッケージに Controller / Service / Mapper / DTO をまとめる。

## レイヤ責務（3-layer）

| レイヤ | サフィックス | 役割 |
| --- | --- | --- |
| Controller | `*Controller` | HTTP I/O、DTO ↔ Domain 変換 |
| Service | `*Service` | ビジネスロジック、**トランザクション境界**（`@Transactional`） |
| Mapper | `*Mapper` | MyBatis インターフェース、SQL ↔ POJO |

- Controller から Mapper を直接呼ばない（必ず Service を挟む）。
- **ArchUnit による強制はしていない**（MVP 期間中は意図的に入れない）。規約はこの記述のみなので、レビュー時に人間が見る。
- Domain = Mapper が返す `record`（振る舞いを持たせない）。

## 命名

- DTO: `XxxCreateRequest` / `XxxUpdateRequest` / `XxxResponse` / `XxxSummary`
- 内部 POJO: `Xxx`
- 例外: `XxxException`（`DomainException` を継承）

## 認証

- acting user は**常に `CurrentUser#requireUserId()` から**取る。`SecurityContextHolder` / `Authentication` / `Principal` を直接触らない。
- リクエストボディの `userId` は信用しない。
- 認可設定は `config/SecurityConfig` に集約。Controller に `@PreAuthorize` を置かない。

## API を追加したら

1. Controller / DTO を実装
2. `make openapi` で `docs/openapi.json` と FE の型を再生成
3. 生成物を**同じコミットに含める**

忘れると `OpenApiSnapshotTest` が落ちる。

## テスト

- `@SpringBootTest` + Testcontainers（実 PostgreSQL）。
- Controller スライスは `@WebMvcTest`、Mapper スライスは `@MybatisTest`。
- 命名は全部 `*Test`（`*IT` は使わない）。アサーションは AssertJ。

## 静的解析

Spotless（google-java-format）のみ。Checkstyle / SpotBugs / NullAway / OWASP は**意図的に入れていない** — 理由はトップ `CLAUDE.md` の「MVP 期間中にやらないこと」を参照。
