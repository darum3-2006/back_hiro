import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Tenant } from '../tenants/tenant.entity';

@Entity({ name: 'users', comment: 'ユーザー（認証アカウント）' })
@Index('uq_users_tenant_email', ['tenantId', 'email'], { unique: true })
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

  @Column({ length: 100, comment: '表示名' })
  name!: string;
}
