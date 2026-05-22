import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { ProjectMember } from '../members/member.entity';
import { Project } from '../projects/project.entity';
import { TaskTag } from './task-tag.entity';

export interface TaskLink {
  label: string;
  url: string;
}

@Entity({ name: 'tasks', comment: 'タスク（プロジェクト単位）' })
// 一覧描画と各種フィルタ用のインデックス（将来サーバ側絞り込みに切替えた時の備え）
@Index('idx_tasks_project_created', ['projectId', 'createdAt'])
@Index('idx_tasks_project_status', ['projectId', 'statusCode'])
@Index('idx_tasks_project_priority', ['projectId', 'priorityCode'])
@Index('idx_tasks_project_assignee', ['projectId', 'assigneeMemberId'])
@Index('idx_tasks_project_deadline', ['projectId', 'deadline'])
// 表示用のプロジェクト内連番（#15 などの表示）
@Index('uq_tasks_project_seq', ['projectId', 'seq'], { unique: true })
export class Task extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'project_id', comment: '所属プロジェクト' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({ type: 'int', comment: 'プロジェクト内連番（表示用）' })
  seq!: number;

  @Column({ type: 'varchar', length: 500, comment: '一覧用の概要 / タイトル' })
  content!: string;

  @Column({ type: 'text', comment: '詳細説明（Markdown）' })
  description!: string;

  @Column({
    type: 'json',
    comment: '関連リンク [{label, url}, ...]',
  })
  links!: TaskLink[];

  @Column({ type: 'varchar', length: 64, name: 'status_code', comment: 'ステータスコード' })
  statusCode!: string;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'priority_code',
    nullable: true,
    comment: '優先度コード（NULL = 未設定）',
  })
  priorityCode!: string | null;

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

  @Column({
    type: 'varchar',
    length: 36,
    name: 'requester_member_id',
    nullable: true,
    comment: '起票者メンバー（NULL = 未設定）',
  })
  requesterMemberId!: string | null;

  @ManyToOne(() => ProjectMember, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'requester_member_id' })
  requesterMember!: ProjectMember | null;

  @Column({
    type: 'varchar',
    length: 64,
    name: 'requesting_dept_code',
    nullable: true,
    comment: '起票部署コード（NULL = 未設定）',
  })
  requestingDeptCode!: string | null;

  @Column({
    type: 'date',
    nullable: true,
    comment: '期限',
  })
  deadline!: string | null;

  @Column({
    type: 'date',
    name: 'planned_completion_date',
    nullable: true,
    comment: '完了予定日',
  })
  plannedCompletionDate!: string | null;

  @Column({
    type: 'datetime',
    precision: 6,
    name: 'completed_at',
    nullable: true,
    comment: '完了日時（ステータスが完了扱いの間だけ値を持つ）',
  })
  completedAt!: Date | null;

  @OneToMany(() => TaskTag, (tt) => tt.task)
  taskTags!: TaskTag[];
}
