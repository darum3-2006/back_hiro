import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';

/** ビューの公開範囲 */
export const SAVED_VIEW_VISIBILITIES = ['private', 'shared'] as const;
export type SavedViewVisibility = (typeof SAVED_VIEW_VISIBILITIES)[number];

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

/**
 * ビューに保存する表示状態一式。
 * filters はフロントの URL クエリ shape（status/priority/assignee/tag/flag、showCompleted、各種日付範囲）に対応。
 * 種類が多く変化しやすいため、フロントを正本として緩く保持する。
 */
export interface SavedViewConfig {
  columns: SavedViewColumns;
  filters: Record<string, unknown>;
  sort: SavedViewSort | null;
}

@Entity({
  name: 'saved_views',
  comment: '保存ビュー（タスク一覧の列/フィルタ/ソート、プロジェクト単位）',
})
// 一覧取得（プロジェクト内の自分の private ＋ shared）用
@Index('idx_saved_views_project_owner', ['projectId', 'ownerUserId'])
// 共有リンク用の不透明な短縮コード（グローバル一意）
@Index('uq_saved_views_short_code', ['shortCode'], { unique: true })
export class SavedView extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'project_id', comment: '所属プロジェクト' })
  projectId!: string;

  @Column({
    type: 'varchar',
    length: 16,
    name: 'short_code',
    comment: '共有リンク用の不透明な短縮コード（/:tenantKey/v/:shortCode、グローバル一意）',
  })
  shortCode!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({
    type: 'varchar',
    length: 36,
    name: 'owner_user_id',
    nullable: true,
    comment: '作成者（NULL = 作成者が削除された孤児ビュー）',
  })
  ownerUserId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner!: User | null;

  @Column({ length: 100, comment: 'ビュー表示名' })
  name!: string;

  @Column({
    type: 'varchar',
    length: 16,
    comment: '公開範囲 (private / shared)',
    default: 'private',
  })
  visibility!: SavedViewVisibility;

  @Column({ type: 'json', comment: '列/フィルタ/ソート設定一式' })
  config!: SavedViewConfig;

  @Column({ type: 'int', name: 'display_order', default: 0, comment: '表示順（小さい順）' })
  displayOrder!: number;
}
