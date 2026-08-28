import type { User, UserRole } from '~/types/master';

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  /** 閲覧を許可するプロジェクト。省略で 0 件（明示付与運用） */
  projectIds?: string[];
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  /** 指定があればパスワードを上書き */
  password?: string;
  /** 指定があれば閲覧できるプロジェクトを丸ごと置き換える */
  projectIds?: string[];
}

/** GET /api/users */
export const apiListUsers = (api: typeof $fetch): Promise<User[]> => api<User[]>('/users');

/** POST /api/users (admin only) */
export const apiCreateUser = (api: typeof $fetch, input: CreateUserInput): Promise<User> =>
  api<User>('/users', { method: 'POST', body: input });

/** PATCH /api/users/:id (admin only) */
export const apiUpdateUser = (
  api: typeof $fetch,
  id: string,
  patch: UpdateUserInput,
): Promise<User> => api<User>(`/users/${id}`, { method: 'PATCH', body: patch });

/** DELETE /api/users/:id (admin only) */
export const apiDeleteUser = async (api: typeof $fetch, id: string): Promise<void> => {
  await api(`/users/${id}`, { method: 'DELETE' });
};

// ===== Excel 同期（設計は docs/USER_EXCEL_SYNC.md） =====

/** Excel の 1 行（パースした生値）。形式エラーはサーバが「エラー」タイプに分類する */
export interface UserSyncRowInput {
  email: string;
  name: string;
  /** ロール列の生値。有効値ならデフォルトロールより優先 */
  role?: string;
}

export interface UserSyncPreviewInput {
  rows: UserSyncRowInput[];
  /** ロール列が空欄・無効な新規追加行に適用するロール */
  defaultRole: UserRole;
  /** 新規追加ユーザーに付与するプロジェクト（デフォルト値） */
  projectIds?: string[];
}

export type UserSyncItemType = 'create' | 'restore' | 'delete' | 'unchanged' | 'error';

export interface UserSyncPreviewItem {
  type: UserSyncItemType;
  /** Excel の行番号（2 始まり）。delete はファイルに行がないため null */
  row: number | null;
  email: string;
  name: string;
  role: UserRole | null;
  /** create のみ: 付与予定のプロジェクト */
  projectIds?: string[];
  /** restore / delete / unchanged: 対象ユーザー ID */
  userId?: string;
  warnings: string[];
  /** delete のみ: 値があると保護のため実行対象にできない */
  protectedReason?: string;
}

export interface UserSyncActionInput {
  type: 'create' | 'restore' | 'delete';
  email?: string;
  name?: string;
  role?: UserRole;
  projectIds?: string[];
  userId?: string;
}

export interface UserSyncExecuteResultItem {
  type: 'create' | 'restore' | 'delete';
  email: string;
  name: string;
  status: 'applied' | 'skipped';
  reason?: string;
}

export interface UserSyncExecuteResult {
  applied: { create: number; restore: number; delete: number };
  skipped: number;
  items: UserSyncExecuteResultItem[];
}

/** POST /api/users/sync/preview (admin only) — 差分計算のみで DB は変更しない */
export const apiPreviewUserSync = (
  api: typeof $fetch,
  input: UserSyncPreviewInput,
): Promise<{ items: UserSyncPreviewItem[] }> =>
  api<{ items: UserSyncPreviewItem[] }>('/users/sync/preview', { method: 'POST', body: input });

/** POST /api/users/sync/execute (admin only) */
export const apiExecuteUserSync = (
  api: typeof $fetch,
  actions: UserSyncActionInput[],
): Promise<UserSyncExecuteResult> =>
  api<UserSyncExecuteResult>('/users/sync/execute', { method: 'POST', body: { actions } });
