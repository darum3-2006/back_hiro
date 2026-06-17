export type SavedViewVisibility = 'private' | 'shared';

/** タスク一覧の列レイアウト */
export interface SavedViewColumns {
  /** 列順（columnId 配列） */
  order: string[];
  /** 表示/非表示（columnId → 表示するか） */
  visibility: Record<string, boolean>;
  /** 列幅(px)（columnId → 幅） */
  sizing: Record<string, number>;
}

/** ソート条件（単一列） */
export interface SavedViewSort {
  columnId: string;
  dir: 'asc' | 'desc';
}

/** ビューに保存する表示状態一式（タスク一覧の URL クエリ shape と対応） */
export interface SavedViewConfig {
  columns: SavedViewColumns;
  filters: Record<string, unknown>;
  sort: SavedViewSort | null;
}

export interface SavedView {
  id: string;
  projectId: string;
  /** 共有リンク用の不透明な短縮コード（/:tenantKey/v/:shortCode） */
  shortCode: string;
  /** 作成者（null = 作成者が削除された孤児ビュー） */
  ownerUserId: string | null;
  name: string;
  visibility: SavedViewVisibility;
  config: SavedViewConfig;
  displayOrder: number;
}

export interface CreateSavedViewInput {
  name: string;
  visibility?: SavedViewVisibility;
  config: SavedViewConfig;
}

export type UpdateSavedViewInput = Partial<CreateSavedViewInput>;
