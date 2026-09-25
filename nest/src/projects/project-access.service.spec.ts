import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectMember } from '../members/member.entity';
import { User } from '../users/user.entity';
import { ProjectAccessService } from './project-access.service';
import { Project } from './project.entity';
import { UserProjectAccess } from './user-project-access.entity';

describe('ProjectAccessService', () => {
  let service: ProjectAccessService;
  let accessRepo: jest.Mocked<Repository<UserProjectAccess>>;
  let projectsRepo: jest.Mocked<Repository<Project>>;
  let membersRepo: jest.Mocked<Repository<ProjectMember>>;
  let usersRepo: jest.Mocked<Repository<User>>;

  const tenantId = 'tenant-1';
  const admin: AuthenticatedUser = { userId: 'u-admin', tenantId, role: 'admin' };
  const member: AuthenticatedUser = { userId: 'u-member', tenantId, role: 'member' };
  const powerUser: AuthenticatedUser = { userId: 'u-power', tenantId, role: 'power_user' };
  const readonlyUser: AuthenticatedUser = { userId: 'u-ro', tenantId, role: 'readonly' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectAccessService,
        {
          provide: getRepositoryToken(UserProjectAccess),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            countBy: jest.fn().mockResolvedValue(0),
            delete: jest.fn().mockResolvedValue(undefined),
            create: jest.fn((dto: Partial<UserProjectAccess>) => dto as UserProjectAccess),
            save: jest.fn((e: unknown) => Promise.resolve(e)),
          },
        },
        {
          provide: getRepositoryToken(Project),
          useValue: { findOne: jest.fn(), countBy: jest.fn() },
        },
        {
          provide: getRepositoryToken(ProjectMember),
          useValue: {
            countBy: jest.fn().mockResolvedValue(0),
            find: jest.fn().mockResolvedValue([]),
            create: jest.fn((dto: Partial<ProjectMember>) => dto as ProjectMember),
            save: jest.fn((e: unknown) => Promise.resolve(e)),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { findOne: jest.fn().mockResolvedValue({ name: '山田' }) },
        },
      ],
    }).compile();

    service = module.get(ProjectAccessService);
    accessRepo = module.get(getRepositoryToken(UserProjectAccess));
    projectsRepo = module.get(getRepositoryToken(Project));
    membersRepo = module.get(getRepositoryToken(ProjectMember));
    usersRepo = module.get(getRepositoryToken(User));
  });

  describe('accessibleProjectIds', () => {
    it('admin は制限なし（null）', async () => {
      await expect(service.accessibleProjectIds(admin)).resolves.toBeNull();
      expect(accessRepo.find).not.toHaveBeenCalled();
    });

    it('admin 以外は設定された ID の配列', async () => {
      accessRepo.find.mockResolvedValue([{ projectId: 'p1' }, { projectId: 'p2' }] as never);

      await expect(service.accessibleProjectIds(member)).resolves.toEqual(['p1', 'p2']);
    });

    it('power_user も制限対象（admin だけが例外）', async () => {
      accessRepo.find.mockResolvedValue([]);

      await expect(service.accessibleProjectIds(powerUser)).resolves.toEqual([]);
    });
  });

  describe('canAccess / assertAccess', () => {
    it('admin は設定を引かずに常に許可', async () => {
      await expect(service.canAccess(admin, 'p1')).resolves.toBe(true);
      expect(accessRepo.countBy).not.toHaveBeenCalled();
    });

    it('設定行があれば許可', async () => {
      accessRepo.countBy.mockResolvedValue(1);

      await expect(service.canAccess(member, 'p1')).resolves.toBe(true);
      expect(accessRepo.countBy).toHaveBeenCalledWith({
        tenantId,
        userId: 'u-member',
        projectId: 'p1',
      });
    });

    it('設定行がなければ 404（存在を伏せるため 403 にしない）', async () => {
      accessRepo.countBy.mockResolvedValue(0);

      await expect(service.assertAccess(member, 'p1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('assertAccessByKey', () => {
    it('key を大文字化して解決し、権限がなければ 404', async () => {
      projectsRepo.findOne.mockResolvedValue({ id: 'p1' } as Project);
      accessRepo.countBy.mockResolvedValue(0);

      await expect(service.assertAccessByKey(member, ' demo ')).rejects.toThrow(NotFoundException);
      expect(projectsRepo.findOne).toHaveBeenCalledWith({
        where: { tenantId, key: 'DEMO' },
        select: { id: true },
      });
    });

    it('存在しない key は通す（各コントローラの 404 に任せる）', async () => {
      projectsRepo.findOne.mockResolvedValue(null);

      await expect(service.assertAccessByKey(member, 'nope')).resolves.toBeUndefined();
    });

    it('admin はプロジェクトを引かずに通す', async () => {
      await expect(service.assertAccessByKey(admin, 'demo')).resolves.toBeUndefined();
      expect(projectsRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('grant', () => {
    it('既に付与済みなら何もしない（冪等）', async () => {
      accessRepo.countBy.mockResolvedValue(1);

      await service.grant(tenantId, 'u-member', 'p1');

      expect(accessRepo.save).not.toHaveBeenCalled();
    });

    it('未付与なら 1 行足す', async () => {
      accessRepo.countBy.mockResolvedValue(0);

      await service.grant(tenantId, 'u-member', 'p1');

      expect(accessRepo.save).toHaveBeenCalledWith({
        tenantId,
        userId: 'u-member',
        projectId: 'p1',
      });
    });
  });

  describe('replaceForUser', () => {
    it('差分だけ反映する（既存行は触らない）', async () => {
      projectsRepo.countBy.mockResolvedValue(2);
      accessRepo.find.mockResolvedValue([
        { id: 'a1', projectId: 'p1' },
        { id: 'a2', projectId: 'p2' },
      ] as never);

      await service.replaceForUser(tenantId, 'u-member', ['p1', 'p3']);

      expect(accessRepo.delete).toHaveBeenCalledWith(['a2']);
      expect(accessRepo.save).toHaveBeenCalledWith([
        { tenantId, userId: 'u-member', projectId: 'p3' },
      ]);
    });

    it('空配列なら全部剥がす', async () => {
      accessRepo.find.mockResolvedValue([{ id: 'a1', projectId: 'p1' }] as never);

      await service.replaceForUser(tenantId, 'u-member', []);

      expect(projectsRepo.countBy).not.toHaveBeenCalled();
      expect(accessRepo.delete).toHaveBeenCalledWith(['a1']);
      expect(accessRepo.save).not.toHaveBeenCalled();
    });

    it('テナント外のプロジェクト ID が混ざっていたら 400', async () => {
      projectsRepo.countBy.mockResolvedValue(1);

      await expect(
        service.replaceForUser(tenantId, 'u-member', ['p1', 'other-tenant']),
      ).rejects.toThrow(BadRequestException);
      expect(accessRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('編集の担い手', () => {
    it('テナント admin もメンバーでなければ編集できない（タスクの作業は参加者だけ）', async () => {
      membersRepo.countBy.mockResolvedValue(0);

      await expect(service.isEditor(admin, 'p1')).resolves.toBe(false);
      await expect(service.assertEditor(admin, 'p1')).rejects.toThrow(ForbiddenException);
    });

    it('管理操作なら、テナント admin はメンバーでなくても通る', async () => {
      membersRepo.countBy.mockResolvedValue(0);

      await expect(
        service.assertEditor(admin, 'p1', { management: true }),
      ).resolves.toBeUndefined();
      expect(membersRepo.countBy).not.toHaveBeenCalled();
    });

    it('管理操作でも、admin でないならメンバーであることが要る', async () => {
      membersRepo.countBy.mockResolvedValue(0);

      await expect(service.assertEditor(member, 'p1', { management: true })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('公開API の管理操作も、テナント admin は key を引かずに通す', async () => {
      await service.assertEditorByKey(admin, 'demo', { management: true });

      expect(projectsRepo.findOne).not.toHaveBeenCalled();
    });

    it('ProjectMember なら編集できる', async () => {
      membersRepo.countBy.mockResolvedValue(1);

      await expect(service.isEditor(member, 'p1')).resolves.toBe(true);
      expect(membersRepo.countBy).toHaveBeenCalledWith({ projectId: 'p1', userId: 'u-member' });
    });

    it('ProjectMember でなければ 403（閲覧はできるので 404 ではない）', async () => {
      membersRepo.countBy.mockResolvedValue(0);

      await expect(service.assertEditor(member, 'p1')).rejects.toThrow(ForbiddenException);
    });

    it('公開API は key から解決して判定する', async () => {
      projectsRepo.findOne.mockResolvedValue({ id: 'p1' } as Project);
      membersRepo.countBy.mockResolvedValue(0);

      await expect(service.assertEditorByKey(powerUser, 'demo')).rejects.toThrow(
        ForbiddenException,
      );
      expect(projectsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantId, key: 'DEMO' } }),
      );
    });
  });

  describe('editableProjectIds（画面の出し分け用）', () => {
    it('readonly ロールはメンバーでもどこも編集できない', async () => {
      const got = await service.editableProjectIds(readonlyUser, ['p1', 'p2']);

      expect(got.size).toBe(0);
      expect(membersRepo.find).not.toHaveBeenCalled();
    });

    it('テナント admin もメンバーになっているプロジェクトだけ（画面でタスクを編集できる所）', async () => {
      membersRepo.find.mockResolvedValue([{ projectId: 'p1' }] as ProjectMember[]);

      const got = await service.editableProjectIds(admin, ['p1', 'p2']);

      expect([...got]).toEqual(['p1']);
    });

    it('それ以外はメンバーになっているプロジェクトだけ', async () => {
      membersRepo.find.mockResolvedValue([{ projectId: 'p2' }] as ProjectMember[]);

      const got = await service.editableProjectIds(member, ['p1', 'p2']);

      expect([...got]).toEqual(['p2']);
    });
  });

  describe('grantCreator', () => {
    it('作成者に閲覧権を付け、プロジェクト管理者としてメンバーに入れる', async () => {
      membersRepo.countBy.mockResolvedValue(0);

      await service.grantCreator(tenantId, 'u-member', 'p1');

      expect(accessRepo.save).toHaveBeenCalled();
      expect(membersRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'p1',
          userId: 'u-member',
          displayName: '山田',
          role: 'admin',
        }),
      );
    });

    it('すでにメンバーなら二重に作らない', async () => {
      membersRepo.countBy.mockResolvedValue(1);

      await service.grantCreator(tenantId, 'u-member', 'p1');

      expect(membersRepo.save).not.toHaveBeenCalled();
      expect(usersRepo.findOne).not.toHaveBeenCalled();
    });
  });
});
