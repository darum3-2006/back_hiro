import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** 監査ログの操作種別。 */
export type AuditAction = 'create' | 'update' | 'delete' | 'restore';

/** 監査対象エンティティの種別。当面 'task' のみだが将来拡張する。 */
export type AuditEntityType = 'task';

/**
 * 1 フィールド分の変更内容。
 * - old/new: 正規化した値（code / memberId / ISO 日付 など）。クリアは null。
 * - oldLabel/newLabel: 表示用スナップショット（ステータス名・メンバー表示名など）。
 *   コードがあとでリネーム・削除されても履歴が読めるよう記録時に焼き込む。
 * - description / links など長文・構造化フィールドは値を持たずフラグのみ（old/new とも null）。
 */
export interface AuditChange {
  field: string;
  old: string | null;
  new: string | null;
  oldLabel?: string | null;
  newLabel?: string | null;
}

/**
 * 監査ログ（追記専用・不変）。
 * 「誰がいつ何を変えたか」を記録する。書き換えない前提なので BaseEntity は継承せず
 * created_at のみ持つ（updated_at / deleted_at は付けない）。
 */
@Entity({ name: 'audit_logs', comment: '監査ログ（追記専用）' })
// エンティティ別タイムライン（タスク詳細の履歴）用
@Index('idx_audit_entity', ['tenantId', 'entityType', 'entityId', 'createdAt'])
// プロジェクト全体の活動フィード用
@Index('idx_audit_project', ['tenantId', 'projectId', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'tenant_id', comment: '所属テナント' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 32, name: 'entity_type', comment: "対象種別（'task' 等）" })
  entityType!: AuditEntityType;

  @Column({ type: 'varchar', length: 36, name: 'entity_id', comment: '対象エンティティ ID' })
  entityId!: string;

  @Column({
    type: 'varchar',
    length: 36,
    name: 'project_id',
    nullable: true,
    comment: '所属プロジェクト（横断フィード用 / NULL = プロジェクト外）',
  })
  projectId!: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    comment: "操作種別（'create'|'update'|'delete'|'restore'）",
  })
  action!: AuditAction;

  @Column({
    type: 'json',
    nullable: true,
    comment: '変更内容 [{field, old, new, oldLabel, newLabel}]（create/delete は NULL 可）',
  })
  changes!: AuditChange[] | null;

  @Column({
    type: 'varchar',
    length: 36,
    name: 'actor_user_id',
    nullable: true,
    comment: '操作した User（退会で SET NULL / システム操作は NULL）',
  })
  actorUserId!: string | null;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'actor_user_name',
    nullable: true,
    comment: '操作者の表示名スナップショット（記録時点）',
  })
  actorUserName!: string | null;

  @CreateDateColumn({ comment: '記録日時' })
  createdAt!: Date;
}
