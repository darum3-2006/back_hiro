import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Project } from '../projects/project.entity';
import type { MasterColor } from './task-status.entity';

@Entity({ name: 'flags', comment: 'タスクフラグ（プロジェクト単位）' })
@Index('uq_flags_project_code', ['projectId', 'code'], { unique: true })
export class Flag extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'project_id', comment: '所属プロジェクト' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({ length: 64, comment: '識別コード（プロジェクト内一意）' })
  code!: string;

  @Column({ length: 100, comment: 'フラグ名' })
  name!: string;

  @Column({ type: 'varchar', length: 16, comment: '表示色' })
  color!: MasterColor;
}
