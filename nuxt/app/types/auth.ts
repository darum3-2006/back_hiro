export type UserRole = 'admin' | 'member';

export interface AuthTenant {
  id: string;
  key: string;
  name: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  tenantId: string;
  role: UserRole;
}

export interface AuthMe extends AuthUser {
  tenant: AuthTenant;
}

export interface LoginInput {
  tenantKey: string;
  email: string;
  password: string;
}

export interface GoogleLoginInput {
  tenantKey: string;
  /** Google Identity Services が返す ID トークン（JWT）。 */
  idToken: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
  tenant: AuthTenant;
}
