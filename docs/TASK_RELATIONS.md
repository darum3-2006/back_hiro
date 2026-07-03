# タスク間の関連 設計メモ

タスク同士に「関連 / 先行・後続 / ブロック」の関連を持たせ、詳細パネルとガントで活かす。

ステータス: 実装済み（2026-07-03 時点）。関連リンク（URL）や本文の `#連番` メンションとは別物の、**構造的なタスク間関連**。

## 方針の要約

- 関連は**有向 source→target の 1 レコード**で保存し、種別は 3 つ：
  - `related`（対称）… 表示は両側とも「関連」
  - `precedes`（有向）… source が**先行** / target が**後続**
  - `blocks`（有向）… source が target を**ブロック**
- **逆向きは自動表示**（1 レコードを両面から見せる）。API は「起点タスクから見た種類（kind）」で受け、保存形へ正規化する。
- 表示は **詳細パネルの「関連タスク」欄** と **ガント（G2 ハイライト＋G3 依存違反）** の 2 面。**一覧・ボードには出さない**。通知もしない。

## データモデル

`comments` / `subtasks` と同じく `project_id` でスコープし、`source_task_id` / `target_task_id` で両端を参照する。

### `task_relations` テーブル

| カラム | 型 | 備考 |
| --- | --- | --- |
| `id` | uuid PK | |
| `project_id` | varchar(36) FK→`projects` | `ON DELETE CASCADE` |
| `source_task_id` | varchar(36) FK→`tasks` | 関連元。`ON DELETE CASCADE` |
| `target_task_id` | varchar(36) FK→`tasks` | 関連先。`ON DELETE CASCADE` |
| `type` | varchar(16) | `related` / `precedes` / `blocks` |
| `created_at` / `updated_at` / `deleted_at` | | `BaseEntity` 共通基底 |

- `UNIQUE (source_task_id, target_task_id, type)`。加えて `related` は対称なので**逆向きの重複も拒否**する。
- **自己関連（source == target）は拒否**。両端は同一プロジェクトに属することを検証。
- タスク削除時は FK CASCADE で関連も消える。

## API（種類の正規化・逆向き表示）

起点タスク視点の `kind`（API 入力）↔ 保存形（source/target/type）の対応：

| kind（入力・起点タスク＝T, 相手＝O） | 保存形 |
| --- | --- |
| `related` | (T, O, `related`) |
| `successor`（O が後続） | (T, O, `precedes`) |
| `predecessor`（O が先行） | (O, T, `precedes`) |
| `blocks`（T が O をブロック） | (T, O, `blocks`) |
| `blocked_by`（O にブロックされる） | (O, T, `blocks`) |

読み出し（タスク T 視点）は逆変換して kind を復元する（`precedes` は source==T→`successor` / target==T→`predecessor`、`blocks` も同様）。

エンドポイント：

- `GET /projects/:projectId/tasks/:taskId/relations` … 起点タスク視点の関連一覧（相手の seq/content/statusCode 付き）
- `POST /projects/:projectId/tasks/:taskId/relations` … `{ otherTaskId, kind }`
- `DELETE /projects/:projectId/tasks/:taskId/relations/:id` … 起点タスクが当事者の関連のみ解除可
- `GET /projects/:projectId/relations` … プロジェクト横断の有向エッジ（ガント用）

## 表示

### 詳細パネル「関連タスク」欄（`TaskRelationsSection`）

折りたたみ（`CollapsibleSection`）で、種別ごとにグルーピング：

```
関連タスク                              [＋ 関連づけ]
先行タスク       #12 決済API実装   [完了]
後続タスク       #34 リリース作業  [未着手]
ブロックしている  #40 検証         [対応中]
ブロックされている #8 仕様確定      [完了]
関連            #20 検索改善       [対応中]  ✕
```

- チップ（#連番＋タイトル＋ステータスバッジ）クリックで該当タスクへ（`?task=seq`）。
- 追加は「種別セレクト＋タスク検索（#番号・タイトル）」。解除は ✕。

### ガント

- **G2 選択時ハイライト**：タスクを開く（`?task=seq`）と、その関連タスク（両方向・全種別）のバーを primary リングで強調。
- **G3 依存違反の警告**：有向関連（`precedes` / `blocks`）で **先行/ブロック元の完了予定日 > 後続/被ブロックの着手予定日** のとき、後続/被ブロック側のバーに赤リング＋ラベルに ⚠。日付が両方揃っている関係のみ判定（サブタスクの親期限超過警告と同じ発想）。
- 矢印（依存線）は今回は描かない（コスト大のため将来の強化候補）。

## 対象外（初期）

- 一覧・ボードには関連を出さない（詳細で管理）。
- 通知（アプリ内・Slack）は関連の作成・解除では出さない。
- ガントの依存線（矢印）。循環依存の検出・警告。
