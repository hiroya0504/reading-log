# frontend/CLAUDE.md

Next.js 16 (App Router) / TypeScript / Tailwind / Vitest。

## コマンド

ルートの `make dev` / `make check` 経由が標準。個別に動かす場合:

| コマンド                            | 用途                                                        |
| ----------------------------------- | ----------------------------------------------------------- |
| `pnpm dev`                          | 開発サーバ起動                                              |
| `pnpm build`                        | 本番ビルド                                                  |
| `pnpm typecheck`                    | 型チェック                                                  |
| `pnpm lint` / `pnpm lint:fix`       | ESLint                                                      |
| `pnpm format` / `pnpm format:check` | Prettier                                                    |
| `pnpm test` / `pnpm test:watch`     | Vitest                                                      |
| `pnpm gen:api`                      | `docs/openapi.json` から `src/lib/api/schema.d.ts` を再生成 |

## API 呼び出し

**手書きの `fetch` を書かない。** API は必ず `src/lib/api/client.ts` の型付きクライアント経由。

```ts
import { api } from "@/lib/api/client";

const { data, error } = await api.GET("/api/books");
```

- パスもレスポンス型も `src/lib/api/schema.d.ts`（`docs/openapi.json` からの生成物）に由来する。存在しないパスやフィールドを書くと `pnpm typecheck` で落ちる。
- `schema.d.ts` は**手で編集しない**。再生成は `make openapi`。
- 認証ヘッダの付与は `client.ts` の 1 箇所だけ。Basic → Cookie / Bearer への差し替えはここを変えるだけで済ませる。
- `client.ts` は `import "server-only"` 付き。**Client Component から import するとビルドエラー**になる。API 呼び出しは Server Component / Server Action / Route Handler から行い、資格情報をブラウザバンドルに載せない。
- 資格情報は `API_BASE_URL` / `API_USERNAME` / `API_PASSWORD`（`NEXT_PUBLIC_` を付けない）。未設定時はローカル既定値 `http://localhost:8080` と `dev` / `dev`。

## 構成

- App Router (`src/app/`)
- テストは `*.test.tsx` を実装ファイルの隣に置く（`@/` エイリアスは `src/`）
- Server Components がデフォルト。クライアント機能は `"use client"` を明示
