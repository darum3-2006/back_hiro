# プロジェクト概要

社内のスプレッドシート（システム改修対応一覧）をリプレースする、マルチテナント型のプロジェクト管理ツール。

## スタック構成

- **フロントエンド:** Nuxt 4 + Nuxt UI 4 + Tailwind 4（`nuxt/` ディレクトリ）
- **バックエンド:** NestJS + TypeORM（`nest/` ディレクトリ）
- **DB:** MySQL 8（ローカル開発はポート 53306、接続情報は `nest/.env`）

## マルチテナンシー方針

- ローンチ時は単一テナントで運用するが、設計は最初からマルチテナント前提
- すべてのテナント所有テーブルに `tenant_id` 列を持たせる
- MySQL 8 に Row Level Security はないため、**アプリ層（Repository）で `tenant_id` フィルタを強制**

**Why:** 将来的に外販 or 他組織へ展開する可能性を残しつつ、初期コストは抑えたい
**運用ルール:**
- 新規テーブル設計時は必ず `tenant_id` を付ける
- Repository で書き込み・読み取りを行う際、リクエストコンテキスト由来の `tenant_id` を必ずクエリ条件に含める（共通基底 Repository / Interceptor で自動付与する設計を想定）
- 直接 SQL を書く場合も `WHERE tenant_id = ?` を必ず付ける運用

## エンティティ階層

```
Tenant
├─ Users          (tenant-scoped, 認証用)
├─ Departments    (tenant-scoped, admin が管理)
└─ Projects       (tenant-scoped)
   ├─ ProjectMembers (project-scoped, displayName 必須・userId は null 可)
   ├─ TaskStatuses   (project-scoped)
   ├─ TaskPriorities (project-scoped)
   ├─ Tags           (project-scoped)
   ├─ Tasks          (project-scoped, requester/assignee は ProjectMember を参照)
   └─ Comments       (Task に紐付く)
```

### スコープ方針: タスク系マスタは project-scoped

- TaskStatus / TaskPriority / Tags はプロジェクトごとに自由に定義可能（Jira/Linear 風）で **project-scoped**
- Departments はプロジェクト横断で使う組織情報のため **tenant-scoped**（例外）。admin が管理
- **Why:** マルチテナント + プロジェクト単位で workflow を変えたいニーズに対応
- **運用ルール:** ワークフロー系マスタを新設するときはデフォルトで project-scoped（`projectId` 必須）。組織横断の参照マスタのみ tenant-scoped を検討

### ProjectMember の設計: Hybrid

- Member は独立エンティティ。`userId` は **null 可**（プレースホルダー運用OK）
- **Why:** 「CS（起票）」「かんとく」のような擬人化メンバーを表現できる
- **運用ルール:** Task の requester/assignee は **必ず Member を参照**（User 直参照は禁止）。監査ログ（`audit_logs`、実装済み）は User を参照

## ビュー設計の方針

- 現在のタスク一覧UIは「デフォルトビュー」と位置付け
- 将来的に **カスタムビュー（共有）** 機能を追加予定
  - 想定: SavedView エンティティ（`projectId`, `name`, `ownerUserId or null=共有`, `columns`, `filters`, `sort`, `viewType`）
- **MVP 範囲外**：MVP ではタスク一覧の columns / filters / sort はハードコード

**運用ルール:** タスク一覧のフィルタやソートを実装する際、将来 SavedView から動的に組み立てやすいよう shape を意識する（visibleColumns, filters, sort の3要素）

## フロントの API 境界

- `nuxt/app/api/*.ts` がバックエンド接続時の差し替えポイント
- 各関数の JSDoc に対応するエンドポイント（例: `GET /projects/{id}/tasks`）を明記
- composable は `useAsyncData` ラッパー（バックエンド接続時に `api/` の中身だけ書き換える）

## バックエンド（`nest/`）

- NestJS 11 + TypeORM 0.3 + MySQL 8 + mysql2 ドライバ
- 命名規約: snake_case（`typeorm-naming-strategies` の `SnakeNamingStrategy`）
- 全エンティティ共通の基底（`src/common/entities/base.entity.ts`）に `created_at` / `updated_at` / `deleted_at` を持たせる（論理削除は `@DeleteDateColumn`）
- 接続設定は `.env`（`DATABASE_HOST/PORT/USERNAME/PASSWORD/NAME`）→ `src/config/database.config.ts`
- マイグレーションは TypeORM CLI（`src/data-source.ts` を `-d` で指定）。`pnpm migration:generate` / `migration:run` / `migration:revert`
- 規約は `nuxt/` と統一（Prettier: `semi: true` / `trailingComma: 'none'` / `printWidth: 100`、ESLint は競合ルールを `eslint-config-prettier` で無効化）
- scripts: `pnpm format` / `format:check` / `lint` / `lint:fix` / `start:dev` / `build` / `test`

## データモデルの中心

- **Task:** `shortCode`, `seq`, `content`, `description`, `links[]`, `requesterMemberId`, `requestingDeptCode`, `assigneeMemberId`, `priorityCode`, `statusCode`, `deadline`, `plannedCompletionDate`, `plannedReleaseDate`, `completedAt`, `tagCodes[]`, `createdAt`
  - `shortCode`: 共有リンク用の不透明な短縮コード（グローバル一意 / `/:tenantKey/:shortCode`）
  - `seq`: プロジェクト内連番（表示用 `#N`）
  - `completedAt`: ステータスが完了扱い（`isTerminal=true`）の間だけ値を持つ
- **TaskLink:** `label`, `url`（タスクごとに複数）
- **Comment:** `projectId`, `taskId`, `authorMemberId`, `body`, `createdAt`, `updatedAt`
