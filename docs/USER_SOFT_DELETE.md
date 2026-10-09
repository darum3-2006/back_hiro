# ユーザー論理削除 設計メモ

ユーザー削除（`DELETE /users/:id`）を物理削除から論理削除（soft delete）に切り替える。

ステータス: 実装済み（2026-08-28）。

## 背景

- 現状の `UsersService.remove()` は `repository.remove()` による**物理削除**。監査ログの actor が辿れなくなり、誤削除からも復元できない。
- 有効フラグ（`users.is_active`）は導入済みで「ログインさせないが履歴は残す」は実現できているが、無効化したユーザーは**ユーザー一覧に残り続ける**。
- `users` テーブルには `BaseEntity` 由来の `deleted_at` 列（`@DeleteDateColumn`）が最初から存在するが、これまで未使用だった。

## 目的と割り切り（要件ヒアリング結果）

| 論点 | 決定 |
| --- | --- |
| 主目的 | 退職者などを**ユーザー一覧から消す**こと |
| 誤削除からの復元 | **運用対応**（DB で `deleted_at` を NULL に戻す）。復元 UI / API は作らない（その後 [USER_EXCEL_SYNC.md](USER_EXCEL_SYNC.md) の「復活」が正式な復元経路になった） |
| メールアドレスの再利用 | **想定しない**。削除済みユーザーと同じメールでの新規作成は 409 エラーでよい |

## 無効化と削除の役割分担

| 手段 | 意味 | 一覧表示 | ログイン | 復帰 |
| --- | --- | --- | --- | --- |
| 無効化（`is_active = false`） | 一時停止 | 残る（「無効」バッジ） | 不可 | UI から「有効化」 |
| 論理削除（`deleted_at` セット） | 退場 | 消える | 不可 | 運用（DB 直接操作） |

## スコープ

- 論理削除に切り替えるのは **`users` のみ**。他ドメイン（タスク・コメント・マスタ等）は物理削除のまま。
  - タスク・コメントはそもそも UI から削除できず、マスタ系は「使用中なら FK violation で 409」の設計が論理削除では機能しなくなるため、対象外とする。

## 挙動仕様

### 削除（`DELETE /users/:id`、admin 専用）

- `repository.remove()` → `repository.softRemove()` に変更（`deleted_at` に日時をセット）。
- 既存ガードは維持: **自己削除禁止**、**最後の有効な admin の削除禁止**（count は TypeORM が削除済みを自動除外するため変更不要）。

### 削除済みユーザーの扱い（TypeORM の自動除外に乗る）

TypeORM は `@DeleteDateColumn` を持つ Entity への `find` / `findOne` / `count` / QueryBuilder に自動で `deleted_at IS NULL` を付与する。これにより追加実装なしで:

- ユーザー一覧（`GET /users`）から消える
- パスワード / Google ログイン不可（`findByTenantAndEmail` / `findByTenantAndGoogleSub` がヒットしない）
- **既存セッションも即失効**（`jwt.strategy.ts` が毎リクエスト `findById` するため 401）
- リフレッシュトークンも使用不可（`refresh()` 内の `findById` で 401）
- 公開 API キーも使用不可（`api-key.guard.ts` の `findByApiKeyHash` がヒットしない）

### 新規作成時の重複チェック

UNIQUE インデックス `uq_users_tenant_email` は削除済み行にも効き続ける（MySQL のため partial unique index は使えない）。`UsersService.create()` の重複チェックを `withDeleted: true` で行い、削除済みユーザーのメールと衝突する場合も DB エラー（500）ではなく **409** を明示メッセージで返す。

## 周辺データの扱い: すべて残す

DB の `ON DELETE CASCADE / SET NULL` は論理削除では発火しない。削除時のクリーンアップは**あえて行わない**:

| データ | 物理削除時の挙動 | 論理削除後 | 残してよい理由 |
| --- | --- | --- | --- |
| `refresh_tokens` | CASCADE で削除 | 残る | `refresh()` がユーザー検索で 401 を返すため実害なし |
| `user_project_access` | CASCADE で削除 | 残る | 復元時に閲覧権限もそのまま戻る |
| `project_members.user_id` | SET NULL | リンク残る | メンバー表示は `display_name` 正本のため壊れない。復元時に紐づきも戻る |
| `saved_views.created_by` | SET NULL | 残る | 影響なし |
| 通知・通知設定 | 残る（FK なし） | 残る | 影響なし |

復元 = `deleted_at` を NULL に戻すだけで削除前の状態（権限・メンバー紐づき含む）に完全に戻る、という設計にする。

## 復元手順（運用）

```sql
UPDATE users SET deleted_at = NULL WHERE id = '<user_id>';
```

- 対象の特定は `SELECT id, email, name, deleted_at FROM users WHERE deleted_at IS NOT NULL;`
- 同一メールの有効ユーザーは仕様上存在し得ない（上記 409）ため、復元で UNIQUE 衝突は起きない。

## 既知の制約（許容する）

- **個人情報の残留**: 氏名・メールは DB に残り続ける。社内ツールとして許容（匿名化・定期パージはしない）。
- **メール再利用不可**: 削除済みユーザーと同じメールで新規作成はできない（409）。要件どおり。
- **Google 連携の隅ケース**: 削除済みユーザーが連携していた Google アカウントを別ユーザーが新規連携しようとすると、`uq_users_tenant_google_sub` 違反で 500 になる。運用上想定しないため対処しない（発生時は DB で削除済み側の `google_sub` を NULL にする）。

## 却下した選択肢

- **復元 UI / 削除済みユーザーの一覧表示** — 頻度が低く運用（DB）で足りる。
- **削除時のメール書き換え（suffix 付与）や生成列による UNIQUE 再構成** — メール再利用の要件がないため不要。MySQL で partial unique index が使えない問題への対処もろとも不要になった。
- **全ドメイン一律の論理削除** — CASCADE 前提の子テーブル整合、マスタの使用中チェック、タスク `seq` / 短縮コード採番の `withDeleted` 対応など影響が広い割に、UI から削除できるのは限られたエンティティのみで必要性が薄い。

## 実装メモ

- 変更は nest 側のみ（`users.service.ts` の `remove()` と `create()`、およびテスト）。**migration 不要**（`deleted_at` 列は既存）。
- フロントは変更不要（削除ボタンの挙動が内部的に論理削除になるだけ。一覧から消える見た目は従来どおり）。
