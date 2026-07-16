import type { UserRole } from '~/types/auth';

/** ユーザーロールの選択肢（表示順）。 */
export const USER_ROLES: UserRole[] = ['admin', 'power_user', 'member', 'readonly'];

/** ロールの短い日本語ラベル。 */
export const USER_ROLE_LABEL: Record<UserRole, string> = {
  admin: '管理者',
  power_user: 'パワーユーザー',
  member: '通常',
  readonly: '閲覧のみ',
};

/** バッジ色（Nuxt UI カラー）。 */
export const USER_ROLE_COLOR: Record<UserRole, 'primary' | 'info' | 'neutral' | 'warning'> = {
  admin: 'primary',
  power_user: 'info',
  member: 'neutral',
  readonly: 'warning',
};

/** APIキーを発行・利用できるロールか（admin / power_user）。 */
export const canUseApiKey = (role: UserRole | undefined): boolean =>
  role === 'admin' || role === 'power_user';
