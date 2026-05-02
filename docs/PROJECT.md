# プロジェクト概要

社内のスプレッドシート（システム改修対応一覧）をリプレースする、マルチテナント型のプロジェクト管理ツール。

## スタック構成

- **フロントエンド:** Nuxt 4 + Nuxt UI 4 + Tailwind 4（`nuxt/` ディレクトリ）
- **バックエンド:** 別途 NestJS で構築予定（未着手）
- **DB:** PostgreSQL（行レベル分離 + RLS でテナント分離想定）

## マルチテナンシー方針

- ローンチ時は単一テナントで運用するが、設計は最初からマルチテナント前提
- すべてのテナント所有テーブルに `tenant_id` 列を持たせる（RLS で強制）

**Why:** 将来的に外販 or 他組織へ展開する可能性を残しつつ、初期コストは抑えたい
**運用ルール:** 新規テーブル設計時は必ず `tenant_id` を付ける。アプリ層では tenant_id を URL/JWT から取り出して RLS のセッション変数にセット

## エンティティ階層

```
Tenant
├─ Users          (tenant-scoped, 認証用)
├─ Departments    (tenant-scoped)
└─ Projects       (tenant-scoped)
   ├─ ProjectMembers (project-scoped, displayName 必須・userId は null 可)
   ├─ TaskStatuses   (project-scoped)
   ├─ TaskPriorities (project-scoped)
   ├─ Tags           (project-scoped)
   ├─ Tasks          (project-scoped, requester/assignee は ProjectMember を参照)
   └─ Comments       (Task に紐付く)
```

### スコープ方針: 全マスタ project-scoped

- TaskStatus / TaskPriority / Tags はプロジェクトごとに自由に定義可能（Jira/Linear 風）
- **Why:** マルチテナント + プロジェクト単位で workflow を変えたいニーズに対応
- **運用ルール:** 新マスタ追加時はデフォルトで project-scoped（`projectId` 必須）

### ProjectMember の設計: Hybrid

- Member は独立エンティティ。`userId` は **null 可**（プレースホルダー運用OK）
- **Why:** 「CS（起票）」「かんとく」のような擬人化メンバーを表現できる
- **運用ルール:** Task の requester/assignee は **必ず Member を参照**（User 直参照は禁止）。監査ログは User を参照

## ビュー設計の方針

- 現在のタスク一覧UIは「デフォルトビュー」と位置付け
- 将来的に **カスタムビュー（共有）** 機能を追加予定
  - 想定: SavedView エンティティ（`projectId`, `name`, `ownerUserId or null=共有`, `columns`, `filters`, `sort`, `viewType`）
- **MVP 範囲外**：MVP ではタスク一覧の columns / filters / sort はハードコード

**運用ルール:** タスク一覧のフィルタやソートを実装する際、将来 SavedView から動的に組み立てやすいよう shape を意識する（visibleColumns, filters, sort の3要素）

## フロントの API 境界

- `nuxt/app/api/*.ts` がバックエンド接続時の差し替えポイント
- 各関数の JSDoc に対応する将来エンドポイント（例: `GET /projects/{id}/tasks`）を明記
- composable は `useAsyncData` ラッパー（バックエンド着手時に `api/` の中身だけ書き換える）

## データモデルの中心

- **Task:** `content`, `description`, `links[]`, `requesterMemberId`, `requestingDeptCode`, `assigneeMemberId`, `priorityCode`, `statusCode`, `deadline`, `plannedCompletionDate`, `tagCodes[]`, `createdAt`
- **TaskLink:** `label`, `url`（タスクごとに複数）
- **Comment:** `projectId`, `taskId`, `authorMemberId`, `body`, `createdAt`, `updatedAt`

## 既存データの移行

- 既存スプレッドシート（`システム改修対応一覧.xlsx`）のデータは移行する予定だが、ツール構築後に検討
- **運用ルール:** 初期実装ではモックデータを使い、実データのインポートは後回し
- 移行時の対応:
  - 既存の Trello URL → `links: [{ label: 'Trello', url: ... }]`
  - 「CS（起票）」「かんとく」のような担当者 → `userId: null` の ProjectMember として作成
