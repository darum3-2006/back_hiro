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
