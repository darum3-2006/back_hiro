import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { ProjectMember } from '../members/member.entity';
import { Project } from '../projects/project.entity';
import { Task } from '../tasks/task.entity';

@Entity({ name: 'subtasks', comment: 'サブタスク（親タスクを束ね役にした軽量な作業単位）' })
// 親タスク内の並び順取得用
@Index('idx_subtasks_task_position', ['taskId', 'position'])
// プロジェクト横断の期限集計（今週リスト）用
@Index('idx_subtasks_project_deadline', ['projectId', 'deadline'])
export class Subtask extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'project_id', comment: '所属プロジェクト' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({ type: 'varchar', length: 36, name: 'task_id', comment: '親タスク' })
  taskId!: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @Column({ type: 'varchar', length: 255, comment: 'サブタスク名' })
  title!: string;

  @Column({
    type: 'varchar',
    length: 36,
    name: 'assignee_member_id',
    nullable: true,
    comment: '担当メンバー（NULL = 未割当）',
  })
  assigneeMemberId!: string | null;

  @ManyToOne(() => ProjectMember, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'assignee_member_id' })
  assigneeMember!: ProjectMember | null;

  @Column({ type: 'date', nullable: true, comment: '期限' })
  deadline!: string | null;

  @Column({ type: 'text', nullable: true, comment: 'メモ（Markdown）' })
  memo!: string | null;

  @Column({
    type: 'boolean',
    default: false,
    comment: '完了フラグ',
    transformer: {
      to: (v: boolean) => v,
      from: (v: number | boolean | null) => Boolean(v),
    },
  })
  done!: boolean;

  @Column({
    type: 'datetime',
    precision: 6,
    name: 'completed_at',
    nullable: true,
    comment: '完了にした日時（done の間だけ値を持つ）',
  })
  completedAt!: Date | null;

  @Column({ type: 'int', comment: '親タスク内の並び順' })
  position!: number;
}
