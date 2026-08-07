import { ExecutionContext, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { ProjectAccessService } from '../projects/project-access.service';
import type { AuthenticatedUser } from './jwt.strategy';
import { ProjectAccessGuard } from './project-access.guard';

describe('ProjectAccessGuard', () => {
  const user: AuthenticatedUser = { userId: 'u1', tenantId: 't1', role: 'member' };

  let access: jest.Mocked<Pick<ProjectAccessService, 'assertAccess' | 'assertAccessByKey'>>;
  let guard: ProjectAccessGuard;

  const contextWith = (req: unknown): ExecutionContext =>
    ({ switchToHttp: () => ({ getRequest: () => req }) }) as ExecutionContext;

  beforeEach(() => {
    access = {
      assertAccess: jest.fn().mockResolvedValue(undefined),
      assertAccessByKey: jest.fn().mockResolvedValue(undefined),
    };
    guard = new ProjectAccessGuard(access as unknown as ProjectAccessService);
  });

  it('内部 API は :projectId で判定する', async () => {
    await expect(
      guard.canActivate(contextWith({ user, params: { projectId: 'p1' } })),
    ).resolves.toBe(true);

    expect(access.assertAccess).toHaveBeenCalledWith(user, 'p1');
    expect(access.assertAccessByKey).not.toHaveBeenCalled();
  });

  it('公開API は :key で判定する', async () => {
    await expect(guard.canActivate(contextWith({ user, params: { key: 'DEMO' } }))).resolves.toBe(
      true,
    );

    expect(access.assertAccessByKey).toHaveBeenCalledWith(user, 'DEMO');
  });

  it('プロジェクトを含まないルートは素通しする（一覧は各コントローラで絞る）', async () => {
    await expect(guard.canActivate(contextWith({ user, params: {} }))).resolves.toBe(true);

    expect(access.assertAccess).not.toHaveBeenCalled();
    expect(access.assertAccessByKey).not.toHaveBeenCalled();
  });

  it('閲覧権がなければ 404 がそのまま伝播する', async () => {
    access.assertAccess.mockRejectedValue(new NotFoundException());

    await expect(
      guard.canActivate(contextWith({ user, params: { projectId: 'p1' } })),
    ).rejects.toThrow(NotFoundException);
  });

  it('認証情報が無ければ 401', async () => {
    await expect(guard.canActivate(contextWith({ params: { projectId: 'p1' } }))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
