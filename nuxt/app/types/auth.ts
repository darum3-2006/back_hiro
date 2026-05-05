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
}

export interface AuthMe extends AuthUser {
  tenant: AuthTenant;
}

export interface LoginInput {
  tenantKey: string;
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
  tenant: AuthTenant;
}
