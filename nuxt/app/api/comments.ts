import type { Comment } from '~/types/comment'
import { MOCK_COMMENTS } from '~/utils/mock-comments'

/** GET /projects/{projectId}/tasks/{taskId}/comments */
export async function fetchComments(projectId: string, taskId: number): Promise<Comment[]> {
  return MOCK_COMMENTS
    .filter(c => c.projectId === projectId && c.taskId === taskId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** POST /projects/{projectId}/tasks/{taskId}/comments */
export async function createComment(
  projectId: string,
  taskId: number,
  input: { authorMemberId: string, body: string }
): Promise<Comment> {
  const nextId = MOCK_COMMENTS.length === 0 ? 1 : Math.max(...MOCK_COMMENTS.map(c => c.id)) + 1
  const c: Comment = {
    id: nextId,
    projectId,
    taskId,
    authorMemberId: input.authorMemberId,
    body: input.body,
    createdAt: new Date().toISOString().slice(0, 19)
  }
  MOCK_COMMENTS.push(c)
  return c
}
