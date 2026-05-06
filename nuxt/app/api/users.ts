import type { User, UserRole } from '~/types/master';

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  /** 指定があればパスワードを上書き */
  password?: string;
}

/** GET /api/users */
export const apiListUsers = (api: typeof $fetch): Promise<User[]> => api<User[]>('/users');

/** POST /api/users (admin only) */
export const apiCreateUser = (api: typeof $fetch, input: CreateUserInput): Promise<User> =>
  api<User>('/users', { method: 'POST', body: input });

/** PATCH /api/users/:id (admin only) */
export const apiUpdateUser = (
  api: typeof $fetch,
  id: string,
  patch: UpdateUserInput,
): Promise<User> => api<User>(`/users/${id}`, { method: 'PATCH', body: patch });

/** DELETE /api/users/:id (admin only) */
export const apiDeleteUser = async (api: typeof $fetch, id: string): Promise<void> => {
  await api(`/users/${id}`, { method: 'DELETE' });
};
