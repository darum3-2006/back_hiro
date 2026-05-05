import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Tenant } from '../tenants/tenant.entity';

@Entity({ name: 'departments', comment: '部署マスタ（テナント単位）' })
@Index('uq_departments_tenant_code', ['tenantId', 'code'], { unique: true })
export class Department extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'tenant_id', comment: '所属テナント' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ length: 64, comment: '識別コード（テナント内一意）' })
  code!: string;

  @Column({ length: 255, comment: '部署名' })
  name!: string;
}
