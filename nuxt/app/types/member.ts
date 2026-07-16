import type { UserRole } from '~/types/auth';

export type MemberRole = 'admin' | 'member';

export interface Member {
  id: string;
  projectId: string;
  displayName: string;
  userId: string | null;
  role: MemberRole;
  /** 紐づくユーザーのテナントロール（未紐付けは null）。readonly は担当者に選べない */
  userRole: UserRole | null;
}
