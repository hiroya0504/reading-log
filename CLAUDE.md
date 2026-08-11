# CLAUDE.md — reading-log

読んだ本を記録する個人用 Web アプリ。**MVP を作り切ることが一次目的**。

## 構成

```
reading-log/
├── backend/     Spring Boot 3.5 / Java 21 / MyBatis / Flyway / PostgreSQL
├── frontend/    Next.js 16 (App Router) / TypeScript / Tailwind / Vitest
├── docs/openapi.json   API 契約のスナップショット（生成物だがコミットする）
├── docker-compose.yml  開発用 PostgreSQL（ホスト側ポートは 5433）
├── lefthook.yml        pre-commit（整形のみ）
└── Makefile            全コマンドのエントリポイント
```

## コマンド

すべて Makefile に集約。**個別のツールを直接叩く必要はない。**

| コマンド | 用途 |
| --- | --- |
| `make setup` | 初回セットアップ（依存導入 + DB 起動 + **lefthook install**） |
| `make dev` | backend + frontend 並列起動 |
| `make check` | **CI が実行するものと完全に同じ**（lint + test + build + openapi-check） |
| `make openapi` | API 契約と FE 型を再生成 |
| `make format` | 自動整形 |
| `make help` | 全コマンド一覧 |

Claude Code のコマンド:

| コマンド | 用途 |
| --- | --- |
| `/review` | PR を開く前のレビュー。独立したレビュアー 3 軸 + 反証パスを収束まで回す |

## レビュー手順

**PR を開く前に `/review` を回す。** CI では動かないので、実行を強制する仕組みは無い。

- レビュアーはコードを書いたセッションとは別の subagent。**変更の要約を渡さない**（渡すと独立性が消える）。
- 各指摘は `fixed` か `rejected(理由付き)` で決着させる。**BLOCKER でも理由を書いて却下してよい**が、
  黙って無視はしない。決着は `.review/<branch>/ledger.md` に残る。
- 収束せずに上限・停滞で止まった場合は**未解決として扱う**。
- `migration` / `auth` に触れる変更は、レビューの結果に関わらず人間のレビューを挟む。
- 仕組みと「いつ捨てるか」は `docs/review-harness.md`。

## API 契約ハーネス（このプロジェクトの中核）

backend と frontend は `docs/openapi.json` を介して型で繋がっている。

```
Controller/DTO を変更
   → OpenApiSnapshotTest が落ちる（契約が古い）
   → make openapi で docs/openapi.json と frontend/src/lib/api/schema.d.ts を再生成
   → FE が消えたフィールドを使っていれば pnpm typecheck が落ちる
```

- `docs/openapi.json` と `frontend/src/lib/api/schema.d.ts` は**生成物だがコミットする**。PR の diff で API 変更が見えることに価値がある。
- 手書きの `fetch` を書かない。API 呼び出しは `frontend/src/lib/api/client.ts` の型付きクライアント経由のみ。

## MVP 期間中にやらないこと（意図的な決定）

前プロジェクト（photo-management）では backend の技術的深掘りに時間を吸われ、動くプロダクトに到達しなかった。同じ失敗を繰り返さないため、以下は**痛い目を見るまで入れない**。

- 認証方式の自前実装 — Basic 認証のまま。差し替え可能性は `CurrentUser` port で担保済み
- ArchUnit / SpotBugs / NullAway / Checkstyle / OWASP / カバレッジ閾値の導入
- 値オブジェクトの過剰導入 — `BookId` / `UserId` のみ。他は素の型でよい
- 本以外のコンテンツ種別への抽象化（`ContentType` を作らない）
- パフォーマンス最適化 / cursor pagination（offset でよい）

これらが必要になったら、**理由を添えて**このリストから外す。

## やってはいけないこと

- 適用済み Flyway migration ファイルの編集（追加のみ可）。
- `main` への直接 push / force push。
- アプリコードから `SecurityContextHolder` / `Authentication` / `Principal` を直接触る（必ず `CurrentUser` 経由）。
- `docs/openapi.json` を手で編集する（必ず `make openapi`）。

## ドキュメント索引

- `backend/CLAUDE.md` — バックエンド規約
- `frontend/CLAUDE.md` — フロントエンド規約
- `docs/architecture.md` — 全体像と設計判断
- `docs/review-harness.md` — `/review` の仕組みと「いつ捨てるか」
