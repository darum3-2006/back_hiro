import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Flag } from '../masters/flag.entity';
import { Subtask } from './subtask.entity';

/**
 * サブタスク ↔ フラグ の中間テーブル（task_flags と同じ作法）。
 * Flag.id を参照する複合 PK（subtask_id, flag_id）。
 */
@Entity({ name: 'subtask_flags', comment: 'サブタスクとフラグの紐付け' })
export class SubtaskFlag {
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'subtask_id', comment: 'サブタスク' })
  subtaskId!: string;

  @PrimaryColumn({ type: 'varchar', length: 36, name: 'flag_id', comment: 'フラグ' })
  flagId!: string;

  @ManyToOne(() => Subtask, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'subtask_id' })
  subtask!: Subtask;

  @ManyToOne(() => Flag, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'flag_id' })
  flag!: Flag;
}
