# back_hiro

社内のスプレッドシート（システム改修対応一覧）をリプレースする、マルチテナント型のプロジェクト管理ツール。

詳細は以下を参照:

- [docs/PROJECT.md](docs/PROJECT.md) — プロジェクト概要・スタック・エンティティ階層・各種設計決定
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) — コーディング規約

## ディレクトリ構成

```
back_hiro/
├── nuxt/    フロントエンド (Nuxt 4 + Nuxt UI 4)
├── nest/    バックエンド (NestJS)
└── docs/    設計ドキュメント
```

## セットアップ

クローン後に 1 回だけ、pre-commit フックを有効化する（コミット時に nest / nuxt の変更を Prettier で自動整形し、CI の `format:check` 落ちを防ぐ）:

```
git config core.hooksPath .githooks
```

## よく使うコマンド

### nuxt/

- `pnpm dev` / `pnpm build` / `pnpm preview`
- `pnpm typecheck` — vue-tsc
- `pnpm lint` / `pnpm lint:fix`
- `pnpm format` / `pnpm format:check`

### nest/

- `pnpm start:dev` / `pnpm build`
- `pnpm test` / `pnpm test:watch` / `pnpm test:cov`
- `pnpm lint` / `pnpm lint:fix` / `pnpm format`
- `pnpm migration:generate <name>` / `pnpm migration:run` / `pnpm migration:revert`
- `pnpm seed` — Tenant + Admin User の最小シード
- `pnpm admin:create-tenant` — テナント追加スクリプト

## 必ず守るルール

詳細は [docs/CONVENTIONS.md](docs/CONVENTIONS.md)。違反しがちな要点だけ抜粋。

- コミットメッセージは日本語。`Co-Authored-By:` 等の trailer は英語のまま
- 関数定義は `const fn = () => {}` 形式。`function` 宣言は使わない（ジェネリックでの可読性低下時のみ例外）
- nuxt 側は `new Date()` 禁止、`dayjs` に統一（ESLint で強制）
- TypeORM `@Entity` / `@Column` には基本 `comment` を付ける（PK は除外可）
- 日時列は Entity では `Date` 型のまま。操作時だけ `dayjs` に変換
- 秘匿 env は `config.getOrThrow<string>('X')`。ハードコードフォールバック禁止
- 全テナント所有テーブルに `tenant_id`。Service / Controller では JWT 由来の `user.tenantId` で必ずスコープ
- パスワード DTO は `@MinLength(8)` + `@MaxLength(72)`（bcrypt 切り詰め & hash DoS 対策）
- 認証系エンドポイントには `@Throttle({ default: { ttl: 60_000, limit: 5 } })` を個別付与
- 実装/テストが完了しても自動でコミットしない。明示指示を待つ

## 入口の地図

- `nuxt/app/api/*.ts` — バックエンド境界。各関数の JSDoc に `GET /xxx` 等のエンドポイントを明記
- `nuxt/app/composables/use*.ts` — `useAsyncData` ラッパー。差し替え単位
- `nuxt/app/pages/[tenantKey]/...` — URL の `tenantKey` は認証ミドルウェアで自テナントと一致確認済み
- `nest/src/<domain>/` — モジュール単位（`auth` / `users` / `tenants` / `projects` / `tasks` / `subtasks` / `task-relations` / `comments` / `masters` / `members` / `departments` / `saved-views` / `notifications` / `slack` / `audit` / `public`）
  - `subtasks` — 親タスク配下の軽量サブタスク（設計は [docs/SUBTASKS.md](docs/SUBTASKS.md)）
  - `task-relations` — タスク間の関連（related / precedes / blocks。設計は [docs/TASK_RELATIONS.md](docs/TASK_RELATIONS.md)）
  - `saved-views` — タスク一覧の保存ビュー（private/shared + 短縮コード共有リンク）
  - `notifications` — アプリ内通知（REST + SSE。タイプ追加は `notification-types.ts` のレジストリに 1 エントリ）
  - `slack` — プロジェクト別 Incoming Webhook 通知（ベストエフォート送信）
  - `audit` — 追記専用の監査ログ（タスクの変更履歴 API の実体）
  - `public` — 公開 API v1（APIキー認証、`/docs` で OpenAPI 配信）
- `nest/src/common/entities/base.entity.ts` — `created_at` / `updated_at` / `deleted_at` 共通基底
- `nest/src/data-source.ts` — TypeORM CLI 用エントリ
- `nest/src/seed/seed.ts` — シードエントリ

## してはいけない

- Task の `requester` / `assignee` に User を直接参照させない（必ず `ProjectMember` 経由）
- `tenant_id` フィルタなしの Repository クエリを書かない
- マスタ系（`TaskStatus` / `TaskPriority` / `Tags`）を tenant-scoped で運用しない（project-scoped）
- 秘匿値（`JWT_SECRET` 等）にハードコードのデフォルトを与えない
