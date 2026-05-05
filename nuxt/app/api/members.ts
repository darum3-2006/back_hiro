import type { Member, MemberRole } from '~/types/member';

import { apiCountTasks } from '~/api/tasks';

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
 * tasks は実 API、comments は backend 未実装のため当面 0 のまま（Step 6 で対応）。
 */
export const countMemberReferences = async (
  api: typeof $fetch,
  projectId: string,
  memberId: string,
): Promise<{ tasksAssignee: number; tasksRequester: number; comments: number }> => {
  const [tasksAssignee, tasksRequester] = await Promise.all([
    apiCountTasks(api, projectId, { assigneeMemberId: memberId }),
    apiCountTasks(api, projectId, { requesterMemberId: memberId }),
  ]);
  return { tasksAssignee, tasksRequester, comments: 0 };
};
