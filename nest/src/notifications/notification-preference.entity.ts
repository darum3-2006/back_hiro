import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

@Entity({ name: 'notification_preferences', comment: 'ユーザーごとの通知 ON/OFF 設定' })
// 既定は ON（行が無ければ有効）。変更したタイプだけ 1 行持つ sparse 設計。
@Index('uq_notification_prefs_user_type', ['userId', 'type'], { unique: true })
export class NotificationPreference extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'user_id', comment: '対象ユーザー' })
  userId!: string;

  @Column({ type: 'varchar', length: 64, comment: '通知タイプ' })
  type!: string;

  @Column({ type: 'boolean', comment: '有効か（false = この通知を受け取らない）' })
  enabled!: boolean;
}
