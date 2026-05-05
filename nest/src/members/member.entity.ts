import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';

export type MemberRole = 'admin' | 'member';

@Entity({ name: 'project_members', comment: 'プロジェクトメンバー（プロジェクト単位）' })
// 同一プロジェクトに同じ User を二重に紐付けない（user_id NULL は MySQL では複数許容）
@Index('uq_project_members_project_user', ['projectId', 'userId'], { unique: true })
export class ProjectMember extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'project_id', comment: '所属プロジェクト' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({
    type: 'varchar',
    length: 36,
    name: 'user_id',
    nullable: true,
    comment: '紐づく User（NULL = 表示名のみのフリー入力メンバー）',
  })
  userId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @Column({ length: 100, name: 'display_name', comment: '表示名' })
  displayName!: string;

  @Column({
    type: 'varchar',
    length: 16,
    comment: 'ロール (admin / member)',
    default: 'member',
  })
  role!: MemberRole;
}
