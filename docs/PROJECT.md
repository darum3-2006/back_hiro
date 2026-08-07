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
│  └─ UserProjectAccess (user × project, 閲覧できるプロジェクトの明示設定)
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

### プロジェクトの閲覧制限: 明示付与（`user_project_access`）

ユーザーは **`user_project_access` に行があるプロジェクトだけ**を閲覧・操作できる。テナント admin はこの設定に関係なく全プロジェクトを閲覧できる。

- **Why:** 「このユーザーには特定プロジェクトを見せたくない」に応えるため。既定を全開放にすると設定漏れがそのまま情報漏れになるので、明示付与を既定にする
- **ProjectMember とは別テーブル:** ProjectMember は「タスクの依頼者/担当者になれる主体」で `user_id` が null の擬人化メンバーも含む別概念。兼用すると「見せるためだけにメンバーへ追加する」「メンバーから外したら見えなくなる」副作用が出る

| 対象 | 既定 |
| --- | --- |
| 新規プロジェクト | 作成者にだけ付与（内部 API / 公開API とも） |
| 新規ユーザー | 0 件（ユーザー管理画面で admin が選ぶ） |
| ProjectMember への追加 | **付与しない**（閲覧権とは独立。必要なら別途 admin が設定する） |

**判定と enforcement:** ロジックは `ProjectAccessService` の 1 か所に集約する。

- `ProjectAccessGuard` — `:projectId`（内部）と `:key`（公開API）の両方を解決して弾く。プロジェクト配下の全コントローラに `@UseGuards(JwtAuthGuard, ProjectAccessGuard)` / `@UseGuards(ApiKeyGuard, ProjectAccessGuard)` で付ける
- 権限がないときは **403 ではなく 404**（見えないプロジェクトの存在自体を伏せる）
- ルートに projectId を持たない横断エンドポイントは Guard で塞げないため、`accessibleProjectIds()`（`null` = 制限なし）を渡して個別に絞る: `GET /projects` / `me/tasks` / `search/tasks` / `tasks/by-code/:code` / `saved-views/by-code/:code` / `notifications`（`project_id` が NULL の通知は常に通す）
- 公開APIキーは `users.api_key_hash` に紐づき `request.user` が JWT と同形になるため、同じ判定がそのまま効く

**運用ルール:** `projects/:projectId/...`（または `v1/projects/:key/...`）の下にコントローラを新設したら `ProjectAccessGuard` を付ける。テナント横断のエンドポイントを新設したら `accessibleProjectIds()` で絞る。

## ビュー設計の方針

タスク一覧の表示状態（列・フィルタ・ソート）は 3 層で扱う。

1. **ハードコード既定** — 列定義（19列）と `DEFAULT_HIDDEN_COLUMNS` はフロント（`tasks/index.vue`）に正本を置く
2. **作業状態（一時）** — ユーザーがその場でいじった列/フィルタ/ソート。URL クエリ（共有リンク用）＋ localStorage に保持。保存されない
3. **SavedView（永続）** — 名前付きで保存し、プロジェクト内で共有もできるビュー

### SavedView（`saved_views` テーブル）

1 プロジェクトに複数行。`config`（json）に列・フィルタ・ソートを一括格納する。

| カラム | 型 | 備考 |
| --- | --- | --- |
| `id` | uuid PK | |
| `project_id` | varchar(36) FK→`projects` | `ON DELETE CASCADE` |
| `owner_user_id` | varchar(36) FK→`users`, nullable | `ON DELETE SET NULL`（孤児化を許容） |
| `short_code` | varchar(16) UNIQUE | 共有リンク用の不透明な短縮コード（base62/10桁、グローバル一意。生成は `common/short-code.ts` を Task と共用） |
| `name` | varchar(100) | 表示名 |
| `visibility` | varchar(16) | `'private'`（既定） / `'shared'` |
| `config` | json | 列+フィルタ+ソート一式（`type: 'json'`、既存 `task.links` と同作法） |
| `display_order` | int | 一覧の並び順 |

`config` の shape（既存のタスク一覧の URL クエリ shape に揃える）:

```jsonc
{
  "columns": {
    "order": ["seq", "content", "..."],      // 列順（columnId 配列）
    "visibility": { "createdAt": false },     // 表示/非表示
    "sizing": { "content": 360 }              // 列幅(px)
  },
  "filters": {                                 // status/priority/assignee/tag/flag(複数選択)、showCompleted、各種日付範囲
    "status": [], "priority": [], "assignee": [], "tag": [], "flag": [],
    "showCompleted": false
  },
  "sort": { "columnId": "deadline", "dir": "asc" }   // 単一列
}
```

**権限:**

| 操作 | 誰が |
| --- | --- |
| 一覧取得 | 自分の `private` 全部 ＋ プロジェクトの `shared` 全部 |
| 作成 | 全プロジェクトメンバー |
| 編集 / 削除 | `owner` のみ。**ただし `owner_user_id IS NULL` かつ `shared` は ProjectMember `admin` が引き取り可** |
| 複製（自分のビュー化） | 閲覧できる人は誰でも（共有ビューを使う経路） |

**API**（`tasks` と同じスコープ作法。`@CurrentUser()` で tenantId、Service は `(tenantId, projectId, …)`、`projects.findByIdInTenant` でスコープ確認）:

```
GET    /projects/:projectId/saved-views
POST   /projects/:projectId/saved-views
PATCH  /projects/:projectId/saved-views/:id
DELETE /projects/:projectId/saved-views/:id
GET    /saved-views/by-code/:code   # 共有リンクの解決（projectId 不要・テナント横断、Task の by-code と同作法）
```

**共有リンク（短縮URL）:** `shared` ビューのみ「リンクを共有」可能。`/:tenantKey/v/:shortCode`（`pages/[tenantKey]/v/[code].vue`）で受け、`by-code` で解決して `…/tasks?view=:viewId` へリダイレクト→該当ビューを選択適用する。`by-code` は `shared` または自分の `private` のみ解決（他人の `private` は 404）。

**フロント挙動:**

- 一覧上部のドロップダウンでビューを切替。選択すると `config` を復元
- **初期表示**：`?view=:id`（共有リンク経由）＞ `tasks:last-view:{projectId}`（localStorage の前回ビュー）＞ ハードコード既定列
- 未保存の作業状態は URL＋localStorage に逃がし、「保存」「新規ビューとして保存」を提示
- 優先順位：`URL（共有リンク） > 選択中の SavedView > ハードコード既定`
- 列の増減は既存 `mergeColumnOrder` で吸収（未知列は無視、新列は既定ルール）

**運用ルール:** タスク一覧のフィルタ/ソート/列を実装・変更する際は、SavedView の `config` shape（`columns` / `filters` / `sort` の 3 要素）と互換が保たれるよう意識する。

### スコープ外（将来）

- プロジェクト既定ビューの admin 指定（全員が同じビューから開始）
- カンバン等の `viewType`

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
