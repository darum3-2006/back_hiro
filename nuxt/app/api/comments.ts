import type { Comment } from '~/types/comment';

export interface CreateCommentInput {
  authorMemberId: string;
  body: string;
}

export interface UpdateCommentInput {
  body: string;
}

export interface CommentFilter {
  authorMemberId?: string;
  taskId?: string;
}

const buildQuery = (filter: CommentFilter): string => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
};

/** GET /api/projects/:projectId/tasks/:taskId/comments */
export const apiListComments = (
  api: typeof $fetch,
  projectId: string,
  taskId: string,
): Promise<Comment[]> => api<Comment[]>(`/projects/${projectId}/tasks/${taskId}/comments`);

/** GET /api/projects/:projectId/comments/count */
export const apiCountComments = async (
  api: typeof $fetch,
  projectId: string,
  filter: CommentFilter = {},
): Promise<number> => {
  const res = await api<{ count: number }>(
    `/projects/${projectId}/comments/count${buildQuery(filter)}`,
  );
  return res.count;
};

/** POST /api/projects/:projectId/tasks/:taskId/comments */
export const apiCreateComment = (
  api: typeof $fetch,
  projectId: string,
  taskId: string,
  input: CreateCommentInput,
): Promise<Comment> =>
  api<Comment>(`/projects/${projectId}/tasks/${taskId}/comments`, {
    method: 'POST',
    body: input,
  });

/** PATCH /api/projects/:projectId/tasks/:taskId/comments/:id */
export const apiUpdateComment = (
  api: typeof $fetch,
  projectId: string,
  taskId: string,
  id: string,
  patch: UpdateCommentInput,
): Promise<Comment> =>
  api<Comment>(`/projects/${projectId}/tasks/${taskId}/comments/${id}`, {
    method: 'PATCH',
    body: patch,
  });

/** DELETE /api/projects/:projectId/tasks/:taskId/comments/:id */
export const apiDeleteComment = async (
  api: typeof $fetch,
  projectId: string,
  taskId: string,
  id: string,
): Promise<void> => {
  await api(`/projects/${projectId}/tasks/${taskId}/comments/${id}`, { method: 'DELETE' });
};
