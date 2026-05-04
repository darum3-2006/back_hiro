import type { Member, MemberRole } from '~/types/member';
import { MOCK_MEMBERS } from '~/utils/mock-members';
import { MOCK_TASKS } from '~/utils/mock-tasks';
import { MOCK_COMMENTS } from '~/utils/mock-comments';

/** GET /projects/{projectId}/members */
export const fetchMembers = async (projectId: string): Promise<Member[]> => {
  return MOCK_MEMBERS.filter((m) => m.projectId === projectId);
};

/** POST /projects/{projectId}/members */
export const createMember = async (
  projectId: string,
  input: { displayName: string; userId: string | null; role: MemberRole }
): Promise<Member> => {
  const nextNum =
    MOCK_MEMBERS.length === 0
      ? 1
      : Math.max(...MOCK_MEMBERS.map((m) => Number.parseInt(m.id.slice(1)) || 0)) + 1;
  const member: Member = {
    id: `m${nextNum}`,
    projectId,
    displayName: input.displayName,
    userId: input.userId,
    role: input.role
  };
  MOCK_MEMBERS.push(member);
  return member;
};

/** PATCH /projects/{projectId}/members/{memberId} */
export const updateMember = async (
  projectId: string,
  memberId: string,
  patch: Partial<Omit<Member, 'id' | 'projectId'>>
): Promise<Member> => {
  const idx = MOCK_MEMBERS.findIndex((m) => m.projectId === projectId && m.id === memberId);
  if (idx < 0) throw new Error(`Member ${memberId} not found`);
  MOCK_MEMBERS[idx] = { ...MOCK_MEMBERS[idx]!, ...patch };
  return MOCK_MEMBERS[idx]!;
};

/** DELETE /projects/{projectId}/members/{memberId} */
export const deleteMember = async (projectId: string, memberId: string): Promise<void> => {
  const idx = MOCK_MEMBERS.findIndex((m) => m.projectId === projectId && m.id === memberId);
  if (idx < 0) throw new Error(`Member ${memberId} not found`);
  MOCK_MEMBERS.splice(idx, 1);
};

/** GET /projects/{projectId}/members/{memberId}/references */
export const countMemberReferences = async (
  projectId: string,
  memberId: string
): Promise<{ tasksAssignee: number; tasksRequester: number; comments: number }> => {
  const tasksAssignee = MOCK_TASKS.filter(
    (t) => t.projectId === projectId && t.assigneeMemberId === memberId
  ).length;
  const tasksRequester = MOCK_TASKS.filter(
    (t) => t.projectId === projectId && t.requesterMemberId === memberId
  ).length;
  const comments = MOCK_COMMENTS.filter(
    (c) => c.projectId === projectId && c.authorMemberId === memberId
  ).length;
  return { tasksAssignee, tasksRequester, comments };
};
