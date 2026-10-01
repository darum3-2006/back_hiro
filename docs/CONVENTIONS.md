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

## セキュリティ

### 秘匿 env は fail-fast

- `JWT_SECRET` など秘匿情報は **ハードコードフォールバック禁止**
- `config.get('X') ?? 'dev-secret'` のような書き方をしない
- `config.getOrThrow<string>('X')` を使い、未設定なら起動時に throw
- 公開リポジトリ上の固定値で署名・検証されると、本番で env 反映漏れの際にトークン偽造される致命傷になる

### レート制限

- `@nestjs/throttler` で全体・ログインともに必ず適用
- AppModule で `ThrottlerModule.forRoot([...])` + `APP_GUARD: ThrottlerGuard`
- 認証系エンドポイントには `@Throttle({ default: { ttl: 60_000, limit: 5 } })` で個別に厳しく
  - `@Throttle` は同名の制限だけを上書きする。分単位の全体制限を `default` という名前にしているのはこのため（名前を変えると個別制限が黙って効かなくなる）
- ALB → nginx → Nest の構成なので、クライアント IP は X-Forwarded-For から取る（IP 単位の制限のため）
  - nginx は `set_real_ip_from`（プライベートアドレス）+ `real_ip_header X-Forwarded-For` + `real_ip_recursive off` で、ALB が末尾に追記した値だけを採用する
  - nginx から Nest へは `X-Forwarded-For $remote_addr` で上書きする（`$proxy_add_x_forwarded_for` の追記だとクライアントの偽装値が残る）
  - Nest は `app.set('trust proxy', 'loopback, linklocal, uniquelocal')` でプライベートアドレスからの接続だけ信頼する（`true` にすると外から直接来たリクエストの偽装 XFF を信じてしまう）

### 入力長の上限

- パスワード DTO には必ず `@MaxLength(72)`
  - bcrypt は 72 byte 超を黙って切り詰めるため、それ以前で reject
  - 長大文字列による hash DoS も防止
- email は RFC 5321 上限の 254
- tenantKey 等の外部入力にも合理的な上限を設ける

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
