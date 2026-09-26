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
- **テストは古典派（Khorikov）で書く。ルールは `.claude/skills/ai-review/references/test-rules.md`**（AI レビューの判定基準を兼ねる）。
  テストを書く・直すときは必ず読む。要点: モックにするのは `client.ts` の `api`・Next.js の実行時・props で渡す Server Action だけ、
  要素は役割と名前（`getByRole` / `getByLabelText`）で探す、境界値は両側、テストに分岐を書かない。ページに分岐や計算を書いたら関数に切り出して単体テストにする。
- Server Components がデフォルト。クライアント機能は `"use client"` を明示

### 境界

守るべき規則。**いずれも現行コードが満たしている**ので、破れていればそれは新しい違反:

- **`lib/api/client.ts` を import するのは `lib/api/` 配下だけ。** `app/` のコンポーネントは
  `lib/api/<resource>.ts` が公開する関数と型だけを使う（現状は `books.ts` / `health.ts`）。
  `client.ts` は `import "server-only"` 付きなので、この境界が資格情報をブラウザバンドルから
  遠ざける実効的な壁になっている。
- **`"use client"` は対話が必要な葉コンポーネントにのみ付ける。** データ取得とページは
  Server Component に残す（現状 `"use client"` は `BookForm.tsx` と `books/[id]/DeleteBookButton.tsx`・`books/[id]/ProgressForm.tsx` のみ）。
- Server Action と Client Component が共有する型は専用ファイルに切る（`book-form-state.ts`）。
  どちらかに置くと `"use client"` 境界をまたぐ import が生まれる。
