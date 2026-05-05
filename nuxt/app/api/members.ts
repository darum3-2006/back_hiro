import type { Member, MemberRole } from '~/types/member';

export interface CreateMemberInput {
  displayName: string;
  userId: string | null;
  role: MemberRole;
}

export interface UpdateMemberInput {
  displayName?: string;
  userId?: string | null;
  role?: MemberRole;
}

/** GET /api/projects/:projectId/members */
export const apiListMembers = (api: typeof $fetch, projectId: string): Promise<Member[]> =>
  api<Member[]>(`/projects/${projectId}/members`);

/** POST /api/projects/:projectId/members */
export const apiCreateMember = (
  api: typeof $fetch,
  projectId: string,
  input: CreateMemberInput,
): Promise<Member> =>
  api<Member>(`/projects/${projectId}/members`, { method: 'POST', body: input });

/** PATCH /api/projects/:projectId/members/:id */
export const apiUpdateMember = (
  api: typeof $fetch,
  projectId: string,
  id: string,
  patch: UpdateMemberInput,
): Promise<Member> =>
  api<Member>(`/projects/${projectId}/members/${id}`, { method: 'PATCH', body: patch });

/** DELETE /api/projects/:projectId/members/:id */
export const apiDeleteMember = async (
  api: typeof $fetch,
  projectId: string,
  id: string,
): Promise<void> => {
  await api(`/projects/${projectId}/members/${id}`, { method: 'DELETE' });
};

/**
 * メンバーが参照されている件数。
 * NOTE: tasks / comments のバックエンドが未実装のため、当面は常に 0 を返す。
 *       Step 5/6 で tasks/comments が入った時点で API 化する。
 */
export const countMemberReferences = async (
  _projectId: string,
  _memberId: string,
): Promise<{ tasksAssignee: number; tasksRequester: number; comments: number }> => {
  return { tasksAssignee: 0, tasksRequester: 0, comments: 0 };
};
