import dayjs from 'dayjs';
import type { Comment } from '~/types/comment';

// Step 6 で実装。当面は空配列を返すスタブ。
// taskId / id は string (UUID) で揃えて、後で実 API に差し替えやすくしておく。

const nowSec = (): string => dayjs().format('YYYY-MM-DDTHH:mm:ss');

/** GET /projects/:projectId/tasks/:taskId/comments */
export const fetchComments = async (
  _projectId: string,
  _taskId: string,
): Promise<Comment[]> => [];

/** POST /projects/:projectId/tasks/:taskId/comments */
export const createComment = async (
  projectId: string,
  taskId: string,
  input: { authorMemberId: string; body: string },
): Promise<Comment> => ({
  id: 'stub',
  projectId,
  taskId,
  authorMemberId: input.authorMemberId,
  body: input.body,
  createdAt: nowSec(),
  updatedAt: null,
});

/** PATCH /projects/:projectId/tasks/:taskId/comments/:commentId */
export const updateComment = async (
  projectId: string,
  taskId: string,
  commentId: string,
  patch: { body: string },
): Promise<Comment> => ({
  id: commentId,
  projectId,
  taskId,
  authorMemberId: '',
  body: patch.body,
  createdAt: nowSec(),
  updatedAt: nowSec(),
});
