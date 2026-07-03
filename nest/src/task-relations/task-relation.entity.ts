import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Project } from '../projects/project.entity';
import { Task } from '../tasks/task.entity';

/**
 * 保存する関連の種類（有向 source→target）。
 * - related : 関連（対称）。表示は両側とも「関連」
 * - precedes: source が先行 / target が後続
 * - blocks  : source が target をブロック
 */
export type TaskRelationType = 'related' | 'precedes' | 'blocks';

@Entity({ name: 'task_relations', comment: 'タスク間の関連（有向 source→target）' })
@Index('idx_task_relations_source', ['sourceTaskId'])
@Index('idx_task_relations_target', ['targetTaskId'])
@Index('idx_task_relations_project', ['projectId'])
@Index('uq_task_relations', ['sourceTaskId', 'targetTaskId', 'type'], { unique: true })
export class TaskRelation extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'project_id', comment: '所属プロジェクト' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({ type: 'varchar', length: 36, name: 'source_task_id', comment: '関連元タスク' })
  sourceTaskId!: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_task_id' })
  sourceTask!: Task;

  @Column({ type: 'varchar', length: 36, name: 'target_task_id', comment: '関連先タスク' })
  targetTaskId!: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_task_id' })
  targetTask!: Task;

  @Column({
    type: 'varchar',
    length: 16,
    comment: '関連種別（related=関連 / precedes=先行→後続 / blocks=ブロック）',
  })
  type!: TaskRelationType;
}
