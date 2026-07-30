import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';
import { Project } from '../projects/project.entity';

export type MasterColor =
  | 'neutral'
  | 'primary'
  | 'secondary'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'rose'
  | 'sky'
  | 'amber'
  | 'fuchsia'
  | 'emerald'
  | 'violet'
  | 'cyan'
  | 'indigo'
  | 'mauve'
  | 'olive';

@Entity({ name: 'task_statuses', comment: 'タスクステータス（プロジェクト単位）' })
@Index('uq_task_statuses_project_code', ['projectId', 'code'], { unique: true })
export class TaskStatus extends BaseEntity {
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

  @Column({
    type: 'boolean',
    name: 'is_terminal',
    default: false,
    comment: '終了状態（true=完了扱い）',
    transformer: {
      to: (v: boolean) => v,
      from: (v: number | boolean | null) => Boolean(v),
    },
  })
  isTerminal!: boolean;
}
