import { CreateDateColumn, DeleteDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * 全エンティティで共有するタイムスタンプ列
 * - created_at / updated_at / deleted_at（論理削除）
 */
export abstract class BaseEntity {
  @CreateDateColumn({ comment: '作成日時' })
  createdAt!: Date;

  @UpdateDateColumn({ comment: '更新日時' })
  updatedAt!: Date;

  @DeleteDateColumn({ nullable: true, comment: '論理削除日時（NULL=有効）' })
  deletedAt!: Date | null;
}
