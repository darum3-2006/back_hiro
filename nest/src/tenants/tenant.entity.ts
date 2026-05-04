import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { User } from '../users/user.entity';

@Entity({ name: 'tenants', comment: 'テナント（契約組織）' })
export class Tenant extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true, length: 64, comment: 'URL 識別子（slug）' })
  key!: string;

  @Column({ length: 255, comment: 'テナント表示名' })
  name!: string;

  @OneToMany(() => User, (user) => user.tenant)
  users!: User[];
}
