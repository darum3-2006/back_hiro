import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Tenant } from '../tenants/tenant.entity';

@Entity({ name: 'users', comment: 'ユーザー（認証アカウント）' })
@Index('uq_users_tenant_email', ['tenantId', 'email'], { unique: true })
// Google SSO 連携用。同一 Google アカウントが別テナントのユーザにも紐づけられるよう
// グローバル一意ではなくテナント内一意にする（NULL は連携前 = 重複可）。
@Index('uq_users_tenant_google_sub', ['tenantId', 'googleSub'], { unique: true })
export class User extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'tenant_id', comment: '所属テナント' })
  tenantId!: string;

  @ManyToOne(() => Tenant, (tenant) => tenant.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ length: 255, comment: 'ログイン用メールアドレス（テナント内一意）' })
  email!: string;

  @Column({ length: 255, comment: 'bcrypt パスワードハッシュ' })
  passwordHash!: string;

  @Column({
    type: 'varchar',
    length: 255,
    name: 'google_sub',
    nullable: true,
    comment: 'Google SSO の subject（sub）。連携済みユーザのみ値を持つ',
  })
  googleSub!: string | null;

  @Column({ length: 100, comment: '表示名' })
  name!: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'member',
    comment:
      'テナント内ロール (admin = テナント管理者 / power_user / member = 通常 / readonly = 閲覧のみ)',
  })
  role!: UserRole;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'api_key_hash',
    nullable: true,
    comment: '公開APIキーの sha256 ハッシュ（平文は保存しない）',
  })
  apiKeyHash!: string | null;

  @Column({
    type: 'varchar',
    length: 16,
    name: 'api_key_prefix',
    nullable: true,
    comment: '表示用のキー先頭プレフィックス',
  })
  apiKeyPrefix!: string | null;

  @Column({
    type: 'datetime',
    precision: 6,
    name: 'api_key_created_at',
    nullable: true,
    comment: 'APIキー発行日時',
  })
  apiKeyCreatedAt!: Date | null;
}

export type UserRole = 'admin' | 'power_user' | 'member' | 'readonly';
