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

### 機能境界

- **機能パッケージは互いを参照しない。** `book` は `user` を import しない。機能をまたぐ共有が
  必要になったら `common/` に置く。対象はコード上の参照（import / 型の使用）で、javadoc の
  `{@link}` は説明なので含めない（`Book` が `user.User` を引いているのはこれ）。
- DTO は Controller と同じ機能パッケージに置く（`<feature>/dto/` か `<feature>/` 直下）。
  **他機能の DTO を参照しない。**
- `config/` は Spring の Config クラスのみ。機能のロジックを置かない。

## レイヤ責務（3-layer）

| レイヤ | サフィックス | 役割 |
| --- | --- | --- |
| Controller | `*Controller` | HTTP I/O、DTO ↔ Domain 変換 |
| Service | `*Service` | ビジネスロジック、**トランザクション境界**（`@Transactional`） |
| Mapper | `*Mapper` | MyBatis インターフェース、SQL ↔ POJO |

守るべき規則。**いずれも現行コードが満たしている**ので、破れていればそれは新しい違反:

- Controller は Mapper を参照しない（必ず Service を挟む）。
- **Controller にビジネス判断（分岐・検証・計算）を書かない。** 境界値の検証は Service に置く
  — `BookService#list` の `limit` 検証がその形（理由は同メソッドの javadoc）。
- `@Transactional` は Service にのみ付ける。Controller / Mapper には付けない。
- acting user は Service が `CurrentUser` から取る。**Controller は userId を受け取らず、下にも渡さない。**
- Domain = Mapper が返す `record`（振る舞いを持たせない）。
- 1 ファイルの公開型は 1 つ。サフィックスが示す役割以外の仕事をさせない。

**ArchUnit による強制はしていない**（MVP 期間中は意図的に入れない）。規約はこの記述のみ。

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
