import { ForbiddenException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import type { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { PublicProjectsController } from './public-projects.controller';

describe('PublicProjectsController', () => {
  let controller: PublicProjectsController;
  let projects: jest.Mocked<
    Pick<ProjectsService, 'listByTenant' | 'findByKeyInTenant' | 'create' | 'update'>
  >;

  const admin: AuthenticatedUser = { userId: 'u1', tenantId: 't1', role: 'admin' };
  const powerUser: AuthenticatedUser = { userId: 'u2', tenantId: 't1', role: 'power_user' };

  const activeProject = {
    id: 'p1',
    key: 'DEMO',
    name: 'デモ',
    description: null,
    archivedAt: null,
  } as Project;
  const archivedProject = { ...activeProject, archivedAt: new Date('2026-07-01') } as Project;

  beforeEach(async () => {
    projects = {
      listByTenant: jest.fn().mockResolvedValue([]),
      findByKeyInTenant: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicProjectsController],
      providers: [
        { provide: ProjectsService, useValue: projects },
        // ApiKeyGuard の依存（ガード自体はユニットテストでは発動しない）
        { provide: UsersService, useValue: {} },
      ],
    }).compile();

    controller = module.get(PublicProjectsController);
  });

  describe('create', () => {
    it('作成して公開形（key 識別・archived 付き）で返す', async () => {
      projects.create.mockResolvedValue(activeProject);

      const result = await controller.create(powerUser, { key: 'demo', name: 'デモ' });

      expect(projects.create).toHaveBeenCalledWith('t1', { key: 'demo', name: 'デモ' });
      expect(result).toEqual({ key: 'DEMO', name: 'デモ', description: null, archived: false });
    });
  });

  describe('update', () => {
    it('key で解決して name / description のみ更新する', async () => {
      projects.findByKeyInTenant.mockResolvedValue(activeProject);
      projects.update.mockResolvedValue({ ...activeProject, name: '新名称' } as Project);

      const result = await controller.update(powerUser, 'demo', { name: '新名称' });

      expect(projects.findByKeyInTenant).toHaveBeenCalledWith('t1', 'demo');
      expect(projects.update).toHaveBeenCalledWith('t1', 'p1', {
        name: '新名称',
        description: undefined,
      });
      expect(result.name).toBe('新名称');
    });
  });

  describe('archive / unarchive', () => {
    it('admin 以外は 403', async () => {
      await expect(controller.archive(powerUser, 'demo')).rejects.toThrow(ForbiddenException);
      await expect(controller.unarchive(powerUser, 'demo')).rejects.toThrow(ForbiddenException);
    });

    it('archive はアーカイブして archived: true を返す', async () => {
      projects.findByKeyInTenant.mockResolvedValue(activeProject);
      projects.update.mockResolvedValue(archivedProject);

      const result = await controller.archive(admin, 'demo');

      expect(projects.update).toHaveBeenCalledWith('t1', 'p1', { archived: true });
      expect(result.archived).toBe(true);
    });

    it('アーカイブ済みへの archive は何もせずそのまま返す（冪等）', async () => {
      projects.findByKeyInTenant.mockResolvedValue(archivedProject);

      const result = await controller.archive(admin, 'demo');

      expect(projects.update).not.toHaveBeenCalled();
      expect(result.archived).toBe(true);
    });

    it('unarchive は復元して archived: false を返す', async () => {
      projects.findByKeyInTenant.mockResolvedValue(archivedProject);
      projects.update.mockResolvedValue(activeProject);

      const result = await controller.unarchive(admin, 'demo');

      expect(projects.update).toHaveBeenCalledWith('t1', 'p1', { archived: false });
      expect(result.archived).toBe(false);
    });

    it('非アーカイブへの unarchive は何もせずそのまま返す（冪等）', async () => {
      projects.findByKeyInTenant.mockResolvedValue(activeProject);

      const result = await controller.unarchive(admin, 'demo');

      expect(projects.update).not.toHaveBeenCalled();
      expect(result.archived).toBe(false);
    });
  });
});
