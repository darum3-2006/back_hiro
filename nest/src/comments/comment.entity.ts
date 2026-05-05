import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { ProjectMember } from '../members/member.entity';
import { Project } from '../projects/project.entity';
import { Task } from '../tasks/task.entity';

@Entity({ name: 'comments', comment: 'タスクコメント' })
@Index('idx_comments_task_created', ['taskId', 'createdAt'])
@Index('idx_comments_project_author', ['projectId', 'authorMemberId'])
export class Comment extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 36, name: 'project_id', comment: '所属プロジェクト' })
  projectId!: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project!: Project;

  @Column({ type: 'varchar', length: 36, name: 'task_id', comment: '対象タスク' })
  taskId!: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @Column({
    type: 'varchar',
    length: 36,
    name: 'author_member_id',
    nullable: true,
    comment: '投稿者メンバー（NULL = 削除済みメンバー）',
  })
  authorMemberId!: string | null;

  @ManyToOne(() => ProjectMember, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'author_member_id' })
  authorMember!: ProjectMember | null;

  @Column({ type: 'text', comment: 'コメント本文（Markdown）' })
  body!: string;
}
