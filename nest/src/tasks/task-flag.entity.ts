import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Flag } from '../masters/flag.entity';
import { Task } from './task.entity';

/**
 * タスク ↔ フラグ の中間テーブル。
 * Flag.id を参照する複合 PK（task_id, flag_id）。
 */
@Entity({ name: 'task_flags', comment: 'タスクとフラグの紐付け' })
export class TaskFlag {
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'task_id', comment: 'タスク' })
  taskId!: string;

  @PrimaryColumn({ type: 'varchar', length: 36, name: 'flag_id', comment: 'フラグ' })
  flagId!: string;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @ManyToOne(() => Flag, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flag_id' })
  flag!: Flag;
}
