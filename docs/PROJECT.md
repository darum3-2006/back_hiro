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

ユーザーは **`user_project_access` に行があるプロジェクトだけ**を閲覧できる。テナント admin はこの設定に関係なく全プロジェクトを閲覧できる。タスクを動かせるかは別に ProjectMember で決まる（下の「権限モデル」）。

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

**運用ルール:** `projects/:projectId/...`（または `v1/projects/:key/...`）の下にコントローラを新設したら `ProjectAccessGuard` を付ける。プロジェクト横断のエンドポイントを新設したら `accessibleProjectIds()` で絞る。

**用語の注意:** 「横断」は常に**プロジェクト横断**（1 テナント内で複数プロジェクトをまたぐ）を指す。**テナントをまたぐ API は存在しない**し、作ってもいけない。スコープは 2 段構えで、どちらも省略しない:

| 段 | 条件 | 意味 |
| --- | --- | --- |
| 1 | `p.tenant_id = :tenantId` | テナントの壁。他社データには決して到達しない（絶対） |
| 2 | `t.project_id IN (:...accessibleProjectIds)` | 閲覧権。同一テナント内でも見えるプロジェクトだけ（`null` = 制限なし） |

### 権限モデル: 誰が何をできるか

**原則: 見られるかは閲覧権、タスクを動かせるかは ProjectMember、プロジェクトの管理は admin も。**

- **閲覧:** そのプロジェクトの閲覧権（`user_project_access`）があるか。テナント `admin` は全プロジェクト
- **タスクまわりの作業:** 閲覧できることに加え、**そのプロジェクトの ProjectMember であること。テナント `admin` も例外にしない。** 閲覧権はあるがメンバーでない人は「**このプロジェクトは見るだけ**」になる
- **プロジェクトの管理**（設定・マスタ・メンバー管理・アーカイブ）: メンバーに加えて、**テナント `admin` はメンバーでなくても行える**
- **Why:** 「このプロジェクトは見せたいが、編集はさせたくない」に応えるため。`readonly` はテナント単位のロールなので、プロジェクトごとに見るだけ／編集できるを分けられない。ProjectMember は「このプロジェクトに参加している人（担当者に選べる人）」なので、参加者だけがタスクを動かせる、外したら動かせなくなる、という動きが素直に表せる。担当者の候補とタスクを動かせる人も一致する
- **admin を例外にしない理由:** 例外にすると「admin なのにコメントだけできない」（コメントの投稿者は ProjectMember として保存する）のような食い違いが出る。admin がタスクに手を入れたいときは、設定画面で自分をメンバーに追加する
- **管理だけ admin を通す理由:** 通さないと admin が自分をメンバーに追加できない（メンバーの追加もプロジェクト配下の書き込みのため）。プロジェクトの立ち上げ・整備は admin の仕事で、タスクを動かすのは参加者の仕事、と分けている
- 閲覧権には ProjectMember を使わない（上の「プロジェクトの閲覧制限」）。見せるためだけにメンバーへ入れると担当者の候補が増える、メンバーから外したら見えなくなる、という副作用が出るため

権限は 3 つの軸を組み合わせて決まる。

| 軸 | 保存先 | 値 |
| --- | --- | --- |
| テナントロール | `users.role` | `admin` / `power_user` / `member` / `readonly` |
| 閲覧権 | `user_project_access` | プロジェクトごとの有無（テナント `admin` は全プロジェクト） |
| ProjectMember | `project_members` | プロジェクトごとの有無と role（`admin` = プロジェクト管理者 / `member`） |

**誰がどうなるか**

| | 閲覧 | タスクまわりの作業 | プロジェクトの管理 |
| --- | --- | --- | --- |
| ProjectMember（`readonly` 以外） | ○ | ○ | ○（メンバー管理はプロジェクト管理者のみ） |
| テナント `admin` ＋ ProjectMember | ○ | ○ | ○ |
| テナント `admin`（メンバーでない） | ○ | ✕（見るだけ） | ○ |
| 閲覧権あり ＋ メンバーでない | ○ | ✕（見るだけ） | ✕ |
| `readonly` ロール | ○（閲覧権のあるプロジェクト） | ✕（メンバーでも） | ✕ |

**操作の分類**

| 分類 | 操作 |
| --- | --- |
| タスクまわりの作業（メンバーのみ） | タスクの作成・編集（タグ・担当者・ステータスなど）・削除 / コメント / サブタスク / 関連タスク / フラグのコピー・移動・一括で外す / 共有保存ビューの作成・名前や中身の編集 |
| プロジェクトの管理（`@ProjectManagement()`。admin はメンバーでなくても可） | プロジェクト設定（名前・色・期限の強調など）/ Slack 設定・テスト送信 / マスタ（ステータス・優先度・タグ・フラグ）の定義の追加・変更・削除・並べ替え / メンバーの管理 / アーカイブ・復元（内部 API・公開 API とも） |

管理の中でも細かい権限は各コントローラ・サービスで別に判定する。

| 操作 | 必要なもの |
| --- | --- |
| メンバーの管理 / Slack 設定 | プロジェクト管理者 または テナント `admin` |
| 共有保存ビューの削除・公開範囲の変更 | 作成者 / プロジェクト管理者 / テナント `admin`（admin はメンバーでなくても可） |
| アーカイブ・復元 | テナント `admin` |
| ユーザー管理・部署管理 | テナント `admin`（`AdminGuard`） |
| 公開 API キーの発行・利用 | テナント `admin` / `power_user`（キーでの書き込みも上のルールに従う） |

**プロジェクトの作成者:** 作成時に閲覧権に加えて、**プロジェクト管理者として ProjectMember にも入れる**（`ProjectAccessService.grantCreator`。内部 API・公開 API とも）。入れないと、作成者が自分で作ったプロジェクトのタスクを動かせないため。

**判定と enforcement:** ロジックは `ProjectAccessService` に集約する。

- `ProjectAccessGuard` が、閲覧（無ければ 404）に続けて、**書き込み系のリクエスト（GET / HEAD / OPTIONS 以外）なら ProjectMember か**（無ければ 403）を判定する。`@ProjectManagement()` が付いた管理操作だけは、テナント `admin` ならメンバーでなくても通す。プロジェクト配下の全コントローラに付いているので、**新しい書き込みエンドポイントは既定で「メンバーのみ」になる**（安全側に倒す）
- 閲覧はできるのでプロジェクトの存在は伏せず、編集できないときは理由を伝える 403 にする
- `readonly` ロールの書き込みは、`ReadonlyWriteBlockInterceptor` がグローバルに一括で 403 にする
- 画面の出し分けは `GET /projects` が返す `canEdit`（そのプロジェクトのメンバーで、`readonly` でない）を使う（`useProjectReadonly()`）。設定画面だけは「`canEdit` またはテナント `admin`」で入れる。実際の可否はサーバが判定するので、画面の判定は見た目のためだけ

**閲覧のみの人にも許可する操作:** プロジェクトのデータを変えない、本人だけに関わる操作に限り、`@AllowReadonly()` を付ける。**readonly ロールとメンバーでない人の両方**がこの印で通る（どちらも「閲覧のみ」のため）。

| 閲覧のみの人でも許可している操作 |
| --- |
| 自分の通知の既読化・通知設定 |
| 自分のパスワード変更 |
| 自分の画面設定（ダッシュボードの基準日付・日数など、`PATCH /me/settings`） |
| 保存ビュー（private のみ。共有ビューに触らせない制約は `SavedViewsService` が「readonly ロールまたはメンバーでない」で判定する） |

**運用ルール:**

- 書き込みエンドポイントを新設したら、次の 2 点を必ず判断する
  - **閲覧のみの人に許可すべきか**。「自分の画面設定」「自分の閲覧の記録」のように本人だけに関わるものは `@AllowReadonly()` が要る。付け忘れると閲覧のみの人だけ 403 になり、フロントで失敗を握りつぶしていると気づけない
  - **プロジェクトの管理か**。設定・マスタ・メンバーのような管理なら `@ProjectManagement()` を付ける。付け忘れるとメンバーでない admin が実行できない
- `@AllowReadonly()` を付けたエンドポイントで共有されるデータ（他の人にも見えるもの）を扱うなら、Service 側で「閲覧のみの人は触れない」制約を必ずかける（保存ビューの例）。印はロールとメンバーの両方を通すので、`user.role === 'readonly'` だけを見る制約では、メンバーでない人がすり抜ける

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
GET    /saved-views/by-code/:code   # 共有リンクの解決（projectId 不要・プロジェクト横断、Task の by-code と同作法）
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
