import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Project } from '../projects/project.entity';
import type { MasterColor } from './task-status.entity';

@Entity({ name: 'task_priorities', comment: 'タスク優先度（プロジェクト単位）' })
@Index('uq_task_priorities_project_code', ['projectId', 'code'], { unique: true })
export class TaskPriority extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'project_id', comment: '所属プロジェクト' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({ length: 64, comment: '識別コード（プロジェクト内一意）' })
  code!: string;

  @Column({ length: 100, comment: '表示ラベル' })
  label!: string;

  @Column({ type: 'varchar', length: 16, comment: '表示色' })
  color!: MasterColor;

  @Column({ type: 'int', name: 'display_order', comment: '表示順（小さい順）' })
  order!: number;
}
