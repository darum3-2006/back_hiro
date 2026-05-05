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
}
