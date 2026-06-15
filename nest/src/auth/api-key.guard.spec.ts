import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { UsersService } from '../users/users.service';
import { ApiKeyGuard } from './api-key.guard';
import { hashApiKey } from './api-key.util';
import type { User } from '../users/user.entity';

const ctxWith = (authorization?: string): { ctx: ExecutionContext; req: { user?: unknown } } => {
  const req: { headers: Record<string, string | undefined>; user?: unknown } = {
    headers: { authorization },
  };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
};

describe('ApiKeyGuard', () => {
  const makeGuard = (findResult: User | null) => {
    const users = { findByApiKeyHash: jest.fn().mockResolvedValue(findResult) };
    return { guard: new ApiKeyGuard(users as unknown as UsersService), users };
  };

  it('Authorization 無しは Unauthorized', async () => {
    const { guard } = makeGuard(null);
    const { ctx } = ctxWith(undefined);
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('Bearer 以外のスキームは Unauthorized', async () => {
    const { guard } = makeGuard(null);
    const { ctx } = ctxWith('Basic abc');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('未知のキーは Unauthorized', async () => {
    const { guard, users } = makeGuard(null);
    const { ctx } = ctxWith('Bearer bh_live_unknown');
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(users.findByApiKeyHash).toHaveBeenCalledWith(hashApiKey('bh_live_unknown'));
  });

  it('有効なキー(power_user)は request.user に {userId, tenantId, role} をセットして true', async () => {
    const user = { id: 'u1', tenantId: 't1', role: 'power_user' } as User;
    const { guard } = makeGuard(user);
    const { ctx, req } = ctxWith('Bearer bh_live_valid');
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toEqual({ userId: 'u1', tenantId: 't1', role: 'power_user' });
  });

  it('member のキーは権限不足で Forbidden', async () => {
    const user = { id: 'u1', tenantId: 't1', role: 'member' } as User;
    const { guard } = makeGuard(user);
    const { ctx } = ctxWith('Bearer bh_live_valid');
    await expect(guard.canActivate(ctx)).rejects.toThrow(ForbiddenException);
  });
});
