import type { Member } from '~/types/member';

/**
 * 担当者に選べるメンバーだけに絞る。
 * readonly（閲覧のみ）ユーザーに紐づくメンバーは担当者にできない（依頼者には選べる）。
 * バックエンド（TasksService.assertAssignableMember）でも同じ制約を検証している。
 */
export const assignableMembers = (members: Member[]): Member[] =>
  members.filter((m) => m.userRole !== 'readonly');
