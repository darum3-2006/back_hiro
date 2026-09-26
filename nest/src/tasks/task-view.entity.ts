import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { Task } from './task.entity';

/**
 * ユーザーごとのタスク閲覧履歴。タスクの詳細を開いたときに記録する。
 *
 * - 同じタスクを再度開いたら行を増やさず viewed_at だけ更新する（(user, task) で一意）
 * - 1 ユーザーあたり直近 TASK_VIEW_HISTORY_LIMIT 件だけ残し、それより古い行は記録時に消す
 * - 履歴に論理削除の意味は無いので BaseEntity は継承しない（監査ログ・中間テーブルと同じ）
 */
@Entity({ name: 'task_views', comment: 'ユーザーごとのタスク閲覧履歴（直近の一定件数だけ保持）' })
@Index('uq_task_views_user_task', ['userId', 'taskId'], { unique: true })
// 「このユーザーの新しい順」を引くため
@Index('idx_task_views_user_viewed', ['userId', 'viewedAt'])
export class TaskView {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'tenant_id', comment: '所属テナント' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id', foreignKeyConstraintName: 'fk_task_views_tenant' })
  tenant!: Tenant;

  @Column({ type: 'varchar', length: 36, name: 'user_id', comment: '閲覧したユーザー' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'fk_task_views_user' })
  user!: User;

  @Column({ type: 'varchar', length: 36, name: 'task_id', comment: '閲覧したタスク' })
  taskId!: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id', foreignKeyConstraintName: 'fk_task_views_task' })
  task!: Task;

  @Column({ type: 'datetime', precision: 6, name: 'viewed_at', comment: '最後に開いた日時' })
  viewedAt!: Date;
}

/** 1 ユーザーあたりに残す閲覧履歴の件数 */
export const TASK_VIEW_HISTORY_LIMIT = 30;
