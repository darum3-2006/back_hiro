/** 監査ログの 1 フィールド変更（バックエンド AuditChange と対応）。 */
export interface AuditChange {
  field: string;
  old: string | null;
  new: string | null;
  oldLabel?: string | null;
  newLabel?: string | null;
}

/** タスク履歴（監査ログ）1 件。GET /projects/:projectId/tasks/:id/activities の要素。 */
export interface TaskActivity {
  id: string;
  action: 'create' | 'update' | 'delete' | 'restore';
  changes: AuditChange[] | null;
  actor: { userId: string | null; name: string | null };
  createdAt: string;
}
