import type { Comment } from '../../comments/comment.entity';

/** 公開API のコメント表現。プロジェクト・タスクの内部 UUID は露出しない */
export interface PublicComment {
  id: string;
  body: string;
  /** 投稿者メンバー（GET /projects/{key}/members の id）。削除済みメンバーは null */
  authorMemberId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const toPublicComment = (c: Comment): PublicComment => ({
  id: c.id,
  body: c.body,
  authorMemberId: c.authorMemberId,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
});
