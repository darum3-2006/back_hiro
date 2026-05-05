import { Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Tag } from '../masters/tag.entity';
import { Task } from './task.entity';

/**
 * タスク ↔ タグ の中間テーブル。
 * Tag.id を参照する複合 PK（task_id, tag_id）。
 */
@Entity({ name: 'task_tags', comment: 'タスクとタグの紐付け' })
export class TaskTag {
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'task_id', comment: 'タスク' })
  taskId!: string;

  @PrimaryColumn({ type: 'varchar', length: 36, name: 'tag_id', comment: 'タグ' })
  tagId!: string;

  @ManyToOne(() => Task, (t) => t.taskTags, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task!: Task;

  @ManyToOne(() => Tag, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tag_id' })
  tag!: Tag;
}
