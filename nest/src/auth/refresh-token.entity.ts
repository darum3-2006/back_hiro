import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from '../users/user.entity';

/**
 * リフレッシュトークン（サーバ側の失効管理用）。
 * 生トークンは保存せず SHA-256 ハッシュのみ保持する。
 * 使用のたびにローテーション（旧行を失効・新行を発行）してスライド延長する。
 */
@Entity({ name: 'refresh_tokens', comment: 'リフレッシュトークン（ハッシュのみ保存）' })
@Index('uq_refresh_tokens_hash', ['tokenHash'], { unique: true })
@Index('idx_refresh_tokens_user', ['userId'])
export class RefreshToken extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'user_id', comment: '対象ユーザー' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'token_hash',
    comment: 'トークンの SHA-256 ハッシュ（hex）。生値は保存しない',
  })
  tokenHash!: string;

  @Column({ type: 'datetime', precision: 6, name: 'expires_at', comment: '有効期限' })
  expiresAt!: Date;

  @Column({
    type: 'datetime',
    precision: 6,
    name: 'revoked_at',
    nullable: true,
    comment: '失効日時（NULL = 有効）。ローテーション/ログアウト/再利用検知でセット',
  })
  revokedAt!: Date | null;
}
