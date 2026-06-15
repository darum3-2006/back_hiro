import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Tenant } from '../tenants/tenant.entity';

@Entity({ name: 'projects', comment: 'プロジェクト' })
@Index('uq_projects_tenant_key', ['tenantId', 'key'], { unique: true })
export class Project extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'tenant_id', comment: '所属テナント' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ length: 64, comment: 'テナント内一意の識別子（URL / 参照用、大文字英数）' })
  key!: string;

  @Column({ length: 255, comment: 'プロジェクト名' })
  name!: string;

  @Column({ type: 'text', nullable: true, comment: '説明' })
  description!: string | null;

  @Column({
    type: 'datetime',
    precision: 6,
    nullable: true,
    name: 'archived_at',
    comment: 'アーカイブ日時（NULL=有効）',
  })
  archivedAt!: Date | null;

  @Column({
    type: 'boolean',
    name: 'highlight_overdue_deadline',
    default: false,
    comment: '期限超過の行を赤く強調する',
    transformer: {
      to: (v: boolean) => v,
      from: (v: number | boolean | null) => Boolean(v),
    },
  })
  highlightOverdueDeadline!: boolean;

  @Column({
    type: 'boolean',
    name: 'highlight_overdue_planned_start',
    default: false,
    comment: '着手予定日超過の行を赤く強調する',
    transformer: {
      to: (v: boolean) => v,
      from: (v: number | boolean | null) => Boolean(v),
    },
  })
  highlightOverduePlannedStart!: boolean;

  @Column({
    type: 'boolean',
    name: 'highlight_overdue_planned_completion',
    default: false,
    comment: '完了予定日超過の行を赤く強調する',
    transformer: {
      to: (v: boolean) => v,
      from: (v: number | boolean | null) => Boolean(v),
    },
  })
  highlightOverduePlannedCompletion!: boolean;

  @Column({
    type: 'boolean',
    name: 'highlight_overdue_planned_release',
    default: false,
    comment: 'リリース予定日超過の行を赤く強調する',
    transformer: {
      to: (v: boolean) => v,
      from: (v: number | boolean | null) => Boolean(v),
    },
  })
  highlightOverduePlannedRelease!: boolean;
}
