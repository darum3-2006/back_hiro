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
    type: 'varchar',
    length: 16,
    nullable: true,
    comment: 'テーマ色（マスタ系と同じ色名。ヘッダ等の背景に使う。NULL=未設定）',
  })
  color!: string | null;

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

  @Column({
    type: 'varchar',
    length: 512,
    nullable: true,
    name: 'slack_webhook_url',
    comment: 'Slack Incoming Webhook URL（NULL=未設定）。書き込み専用でレスポンスには出さない',
  })
  slackWebhookUrl!: string | null;

  @Column({
    type: 'boolean',
    name: 'slack_notify_task_created',
    default: true,
    comment: 'Slack: 新しいタスクが登録されたとき通知する',
    transformer: {
      to: (v: boolean) => v,
      from: (v: number | boolean | null) => Boolean(v),
    },
  })
  slackNotifyTaskCreated!: boolean;

  @Column({
    type: 'boolean',
    name: 'slack_notify_status_changed',
    default: true,
    comment: 'Slack: タスクのステータスが変わったとき（完了除く）通知する',
    transformer: {
      to: (v: boolean) => v,
      from: (v: number | boolean | null) => Boolean(v),
    },
  })
  slackNotifyStatusChanged!: boolean;

  @Column({
    type: 'boolean',
    name: 'slack_notify_task_completed',
    default: true,
    comment: 'Slack: タスクが完了したとき通知する',
    transformer: {
      to: (v: boolean) => v,
      from: (v: number | boolean | null) => Boolean(v),
    },
  })
  slackNotifyTaskCompleted!: boolean;
}
