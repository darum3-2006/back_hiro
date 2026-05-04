# コーディング規約

## Git

### コミットメッセージは日本語

- subject 1行目・本文ともに日本語で書く
- `Co-Authored-By:` などのトレーラーは規定フォーマットのため英語のまま
- 既存の英語コミットは遡って書き換えない

## TypeScript / Vue

### 関数定義は const 形式

```ts
// Good
const handleClick = () => { ... }
const fetchData = async (id: string) => { ... }

// Bad
function handleClick() { ... }
async function fetchData(id: string) { ... }
```

**Why:** 一貫性と巻き上げ事故の防止
**例外:** ジェネリックの記述が煩雑になる場合のみ `function fn<T>(x: T)` を許容

### 適用範囲

- Vue の `<script setup>` 内のヘルパー・ハンドラ全般
- TypeScript モジュールの export 関数（`export const fn = () => {}`）
- `async function` も `const fn = async () => {}` に統一

## TypeORM エンティティ

### コメント必須

- `@Entity({ comment: 'テーブルの役割' })`
- `@Column({ comment: '列の意味' })`
- **例外:** PK `id` 列はスキップ可
- BaseEntity の created_at / updated_at / deleted_at にもコメント
- 日本語 OK（DB の SQL コメントとしてそのまま保存される）

### 日時の扱い

- **Entity の date 列は `Date` 型のまま**（TypeORM 標準）
- 加算・比較・整形が必要なときに **dayjs** を使う（バックエンド側の utility / service 内）
- API レスポンスは Date → ISO 文字列が JSON.stringify で自動変換されるので、追加処理不要
- フロントは API から ISO 文字列で受け取り、`@internationalized/date` ／ `dayjs` で扱う

## ツール

### 整形と Lint

- **Prettier** が整形担当（`.prettierrc.json` 参照）。`semi: true`, `singleQuote: true`, `trailingComma: 'all'`, `printWidth: 100`, `tabWidth: 2`
- **ESLint** はロジック系・Vue 固有ルールを担当。スタイル系ルールは off（`stylistic: false` + `eslint-config-prettier`）

```bash
pnpm format         # Prettier で整形
pnpm format:check   # 整形チェックのみ
pnpm lint           # ESLint
pnpm lint:fix       # ESLint 自動修正
pnpm typecheck      # vue-tsc
```
