import { apiCountComments } from '~/api/comments';
import { apiCountTasks } from '~/api/tasks';
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

export interface BulkCreateMembersInput {
  displayNames: string[];
  role: MemberRole;
}

/** POST /api/projects/:projectId/members/bulk — 表示名を複数まとめて追加（User 紐付け無し） */
export const apiBulkCreateMembers = (
  api: typeof $fetch,
  projectId: string,
  input: BulkCreateMembersInput,
): Promise<Member[]> =>
  api<Member[]>(`/projects/${projectId}/members/bulk`, { method: 'POST', body: input });

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
 * tasks の担当/起票件数 + コメント投稿数を実 API で並列取得。
 */
export const countMemberReferences = async (
  api: typeof $fetch,
  projectId: string,
  memberId: string,
): Promise<{ tasksAssignee: number; tasksRequester: number; comments: number }> => {
  const [tasksAssignee, tasksRequester, comments] = await Promise.all([
    apiCountTasks(api, projectId, { assigneeMemberId: memberId }),
    apiCountTasks(api, projectId, { requesterMemberId: memberId }),
    apiCountComments(api, projectId, { authorMemberId: memberId }),
  ]);
  return { tasksAssignee, tasksRequester, comments };
};
