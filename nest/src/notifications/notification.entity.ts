import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

@Entity({ name: 'notifications', comment: 'アプリ内通知（受信者ごと 1 レコード）' })
// 受信者ごとの新着順 / 未読取得用
@Index('idx_notifications_user', ['tenantId', 'userId', 'createdAt'])
export class Notification extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'tenant_id', comment: '所属テナント' })
  tenantId!: string;

  @Column({ type: 'varchar', length: 36, name: 'user_id', comment: '受信者（User）' })
  userId!: string;

  @Column({ type: 'varchar', length: 64, comment: "通知タイプ（'assigned' 等）" })
  type!: string;

  @Column({
    type: 'varchar',
    length: 36,
    name: 'project_id',
    nullable: true,
    comment: '関連プロジェクト',
  })
  projectId!: string | null;

  @Column({
    type: 'varchar',
    length: 36,
    name: 'task_id',
    nullable: true,
    comment: '関連タスク',
  })
  taskId!: string | null;

  @Column({
    type: 'int',
    name: 'task_seq',
    nullable: true,
    comment: '関連タスクのプロジェクト内連番（リンク/表示用 #N）',
  })
  taskSeq!: number | null;

  @Column({
    type: 'varchar',
    length: 36,
    name: 'actor_user_id',
    nullable: true,
    comment: '通知の原因となった操作者（NULL = システム）',
  })
  actorUserId!: string | null;

  @Column({ type: 'varchar', length: 500, comment: '表示メッセージ' })
  message!: string;

  @Column({ type: 'datetime', name: 'read_at', nullable: true, comment: '既読日時（NULL = 未読）' })
  readAt!: Date | null;
}
