import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ProjectAccessService } from '../projects/project-access.service';
import { ALLOW_READONLY_KEY } from './allow-readonly.decorator';
import { PROJECT_MANAGEMENT_KEY } from './project-management.decorator';
import type { AuthenticatedUser } from './jwt.strategy';
import { ProjectAccessGuard } from './project-access.guard';

describe('ProjectAccessGuard', () => {
  const user: AuthenticatedUser = { userId: 'u1', tenantId: 't1', role: 'member' };

  let access: jest.Mocked<
    Pick<
      ProjectAccessService,
      'assertAccess' | 'assertAccessByKey' | 'assertEditor' | 'assertEditorByKey'
    >
  >;
  let guard: ProjectAccessGuard;

  const handler = () => undefined;
  const allowedHandler = () => undefined;
  Reflect.defineMetadata(ALLOW_READONLY_KEY, true, allowedHandler);
  const managementHandler = () => undefined;
  Reflect.defineMetadata(PROJECT_MANAGEMENT_KEY, true, managementHandler);

  const contextWith = (req: unknown, h: () => void = handler): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => h,
      getClass: () => class {},
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    access = {
      assertAccess: jest.fn().mockResolvedValue(undefined),
      assertAccessByKey: jest.fn().mockResolvedValue(undefined),
      assertEditor: jest.fn().mockResolvedValue(undefined),
      assertEditorByKey: jest.fn().mockResolvedValue(undefined),
    };
    guard = new ProjectAccessGuard(access as unknown as ProjectAccessService, new Reflector());
  });

  describe('閲覧', () => {
    it('内部 API は :projectId で判定する', async () => {
      await expect(
        guard.canActivate(contextWith({ method: 'GET', user, params: { projectId: 'p1' } })),
      ).resolves.toBe(true);

      expect(access.assertAccess).toHaveBeenCalledWith(user, 'p1');
      expect(access.assertAccessByKey).not.toHaveBeenCalled();
    });

    it('公開API は :key で判定する', async () => {
      await expect(
        guard.canActivate(contextWith({ method: 'GET', user, params: { key: 'DEMO' } })),
      ).resolves.toBe(true);

      expect(access.assertAccessByKey).toHaveBeenCalledWith(user, 'DEMO');
    });

    it('プロジェクトを含まないルートは素通しする（一覧は各コントローラで絞る）', async () => {
      await expect(
        guard.canActivate(contextWith({ method: 'POST', user, params: {} })),
      ).resolves.toBe(true);

      expect(access.assertAccess).not.toHaveBeenCalled();
      expect(access.assertEditor).not.toHaveBeenCalled();
    });

    it('閲覧権がなければ 404 がそのまま伝播する（編集の判定までは進まない）', async () => {
      access.assertAccess.mockRejectedValue(new NotFoundException());

      await expect(
        guard.canActivate(contextWith({ method: 'PATCH', user, params: { projectId: 'p1' } })),
      ).rejects.toThrow(NotFoundException);
      expect(access.assertEditor).not.toHaveBeenCalled();
    });

    it('認証情報が無ければ 401', async () => {
      await expect(
        guard.canActivate(contextWith({ method: 'GET', params: { projectId: 'p1' } })),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('編集', () => {
    it('GET / HEAD / OPTIONS はメンバーでなくても通す（閲覧のみ）', async () => {
      for (const method of ['GET', 'HEAD', 'OPTIONS']) {
        await guard.canActivate(contextWith({ method, user, params: { projectId: 'p1' } }));
      }
      expect(access.assertEditor).not.toHaveBeenCalled();
    });

    it.each(['POST', 'PATCH', 'PUT', 'DELETE'])('%s はメンバーか確かめる', async (method) => {
      await guard.canActivate(contextWith({ method, user, params: { projectId: 'p1' } }));

      expect(access.assertEditor).toHaveBeenCalledWith(user, 'p1', { management: false });
    });

    it('メンバーでなければ 403 がそのまま伝播する', async () => {
      access.assertEditor.mockRejectedValue(new ForbiddenException());

      await expect(
        guard.canActivate(contextWith({ method: 'PATCH', user, params: { projectId: 'p1' } })),
      ).rejects.toThrow(ForbiddenException);
    });

    it('公開API の書き込みも :key でメンバーか確かめる', async () => {
      await guard.canActivate(contextWith({ method: 'POST', user, params: { key: 'DEMO' } }));

      expect(access.assertEditorByKey).toHaveBeenCalledWith(user, 'DEMO', { management: false });
    });

    it('@ProjectManagement() が付いた書き込みは、管理操作として判定させる', async () => {
      await guard.canActivate(
        contextWith({ method: 'PATCH', user, params: { projectId: 'p1' } }, managementHandler),
      );

      expect(access.assertEditor).toHaveBeenCalledWith(user, 'p1', { management: true });
    });

    it('@AllowReadonly() が付いた書き込みは、メンバーでなくても通す（本人だけに関わる操作）', async () => {
      await guard.canActivate(
        contextWith({ method: 'POST', user, params: { projectId: 'p1' } }, allowedHandler),
      );

      expect(access.assertAccess).toHaveBeenCalledWith(user, 'p1');
      expect(access.assertEditor).not.toHaveBeenCalled();
    });
  });
});
