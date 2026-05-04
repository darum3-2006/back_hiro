export type MemberRole = 'admin' | 'member';

export interface Member {
  id: string;
  projectId: string;
  displayName: string;
  userId: string | null;
  role: MemberRole;
}
