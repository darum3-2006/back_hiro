import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';
import { Project } from './project.entity';

/**
 * ユーザーが閲覧できるプロジェクトの明示設定。
 *
 * - 行があるプロジェクトだけ見える（明示付与運用）。
 * - テナント admin はこのテーブルに関係なく全プロジェクトを閲覧できる。
 * - 内部 API / 公開API（APIキー）のどちらも同じ設定で制限される。
 *   APIキーは `users.api_key_hash` に紐づくため、キー所有ユーザーの設定がそのまま効く。
 */
@Entity({
  name: 'user_project_access',
  comment: 'ユーザーが閲覧できるプロジェクト（admin は設定に関係なく全件閲覧可）',
})
// 同じ (user, project) を二重に登録しない
@Index('uq_user_project_access_user_project', ['userId', 'projectId'], { unique: true })
// 「このプロジェクトを見られるのは誰か」の逆引き用
@Index('idx_user_project_access_project', ['projectId'])
export class UserProjectAccess extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'tenant_id', comment: '所属テナント' })
  tenantId!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ type: 'varchar', length: 36, name: 'user_id', comment: '対象ユーザー' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({
    type: 'varchar',
    length: 36,
    name: 'project_id',
    comment: '閲覧を許可するプロジェクト',
  })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;
}
