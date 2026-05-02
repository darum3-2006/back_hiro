# コーディング規約

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
