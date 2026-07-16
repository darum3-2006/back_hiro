import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { MembersService } from '../members/members.service';
import type { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { SavedView, type SavedViewConfig } from './saved-view.entity';
import { SavedViewsService } from './saved-views.service';

describe('SavedViewsService', () => {
  let service: SavedViewsService;
  let repo: jest.Mocked<Repository<SavedView>>;
  let projects: jest.Mocked<Pick<ProjectsService, 'findByIdInTenant'>>;
  let members: jest.Mocked<Pick<MembersService, 'assertProjectAdmin'>>;

  const tenantId = 'tenant-1';
  const projectId = 'project-1';
  const owner: AuthenticatedUser = { userId: 'user-1', tenantId, role: 'member' };
  const other: AuthenticatedUser = { userId: 'user-2', tenantId, role: 'member' };
  const readonlyUser: AuthenticatedUser = { userId: 'user-3', tenantId, role: 'readonly' };

  const config: SavedViewConfig = {
    columns: { order: ['seq', 'content'], visibility: {}, sizing: {} },
    filters: {},
    sort: null,
  };

  const baseView: SavedView = {
    id: 'v1',
    projectId,
    shortCode: 'abc1234567',
    project: { id: projectId } as Project,
    ownerUserId: owner.userId,
    owner: null,
    name: 'My View',
    visibility: 'private',
    config,
    displayOrder: 0,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
  } as SavedView;

  /** resolveByCode 用の QueryBuilder モックを差し込み、getOne の戻り値を設定する */
  const mockQueryBuilder = (result: SavedView | null) => {
    const qb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(result),
    };
    repo.createQueryBuilder.mockReturnValue(qb as never);
    return qb;
  };

  beforeEach(async () => {
    projects = { findByIdInTenant: jest.fn().mockResolvedValue({ id: projectId } as Project) };
    members = { assertProjectAdmin: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavedViewsService,
        {
          provide: getRepositoryToken(SavedView),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn((dto: Partial<SavedView>) => dto as SavedView),
            save: jest.fn((entity: SavedView) => Promise.resolve(entity)),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        { provide: ProjectsService, useValue: projects },
        { provide: MembersService, useValue: members },
      ],
    }).compile();

    service = module.get(SavedViewsService);
    repo = module.get(getRepositoryToken(SavedView));
  });

  describe('listForUser', () => {
    it('自分の private と shared を OR 条件で displayOrder 昇順取得', async () => {
      const items = [baseView];
      repo.find.mockResolvedValue(items);

      const result = await service.listForUser(tenantId, projectId, owner);

      expect(result).toBe(items);
      expect(repo.find).toHaveBeenCalledWith({
        where: [
          { projectId, visibility: 'shared' },
          { projectId, ownerUserId: owner.userId },
        ],
        order: { displayOrder: 'ASC', createdAt: 'ASC' },
      });
    });
  });

  describe('create', () => {
    it('owner を設定し visibility は既定 private、name は trim', async () => {
      const result = await service.create(tenantId, projectId, owner, {
        name: '  集計ビュー  ',
        config,
      });

      expect(result.ownerUserId).toBe(owner.userId);
      expect(result.visibility).toBe('private');
      expect(result.name).toBe('集計ビュー');
      expect(result.projectId).toBe(projectId);
      expect(result.shortCode).toHaveLength(10);
    });

    it('visibility 指定を尊重する', async () => {
      const result = await service.create(tenantId, projectId, owner, {
        name: 'shared one',
        visibility: 'shared',
        config,
      });

      expect(result.visibility).toBe('shared');
    });

    it('readonly ユーザーは private なら作成できる', async () => {
      const result = await service.create(tenantId, projectId, readonlyUser, {
        name: 'my view',
        config,
      });

      expect(result.visibility).toBe('private');
    });

    it('readonly ユーザーは shared ビューを作成できない', async () => {
      await expect(
        service.create(tenantId, projectId, readonlyUser, {
          name: 'shared one',
          visibility: 'shared',
          config,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('owner 本人は更新できる', async () => {
      repo.findOne.mockResolvedValue({ ...baseView });

      const result = await service.update(tenantId, projectId, 'v1', owner, { name: '改名' });

      expect(result.name).toBe('改名');
    });

    it('他人の private は存在を秘して NotFound', async () => {
      repo.findOne.mockResolvedValue({ ...baseView });

      await expect(service.update(tenantId, projectId, 'v1', other, { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('他人の shared は閲覧できるが編集は Forbidden', async () => {
      repo.findOne.mockResolvedValue({ ...baseView, visibility: 'shared' });

      await expect(service.update(tenantId, projectId, 'v1', other, { name: 'x' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('owner=null の孤児 shared は ProjectMember admin が引き取り可', async () => {
      repo.findOne.mockResolvedValue({ ...baseView, ownerUserId: null, visibility: 'shared' });

      const result = await service.update(tenantId, projectId, 'v1', other, { name: '引き取り' });

      expect(members.assertProjectAdmin).toHaveBeenCalledWith(tenantId, projectId, other);
      expect(result.name).toBe('引き取り');
    });

    it('孤児 shared でも admin でなければ assertProjectAdmin が弾く', async () => {
      repo.findOne.mockResolvedValue({ ...baseView, ownerUserId: null, visibility: 'shared' });
      members.assertProjectAdmin.mockRejectedValue(new ForbiddenException());

      await expect(service.update(tenantId, projectId, 'v1', other, { name: 'x' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('readonly ユーザーは自分の private を更新できる', async () => {
      repo.findOne.mockResolvedValue({ ...baseView, ownerUserId: readonlyUser.userId });

      const result = await service.update(tenantId, projectId, 'v1', readonlyUser, {
        name: '改名',
      });

      expect(result.name).toBe('改名');
    });

    it('readonly ユーザーは private→shared にできない', async () => {
      repo.findOne.mockResolvedValue({ ...baseView, ownerUserId: readonlyUser.userId });

      await expect(
        service.update(tenantId, projectId, 'v1', readonlyUser, { visibility: 'shared' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('readonly ユーザーは孤児 shared の引き取りもできない', async () => {
      repo.findOne.mockResolvedValue({ ...baseView, ownerUserId: null, visibility: 'shared' });

      await expect(
        service.update(tenantId, projectId, 'v1', readonlyUser, { name: 'x' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('duplicate', () => {
    it('shared ビューを自分の private として複製する', async () => {
      repo.findOne.mockResolvedValue({
        ...baseView,
        ownerUserId: owner.userId,
        visibility: 'shared',
      });

      const result = await service.duplicate(tenantId, projectId, 'v1', other);

      expect(result.ownerUserId).toBe(other.userId);
      expect(result.visibility).toBe('private');
      expect(result.name).toBe('My View のコピー');
      expect(result.config).toBe(config);
    });
  });

  describe('resolveByCode', () => {
    it('共有ビューは projectId / viewId を解決する', async () => {
      mockQueryBuilder({ ...baseView, visibility: 'shared' });

      const result = await service.resolveByCode(tenantId, 'abc1234567', other);

      expect(result).toEqual({ projectId, viewId: 'v1' });
    });

    it('自分の private は解決できる', async () => {
      mockQueryBuilder({ ...baseView });

      const result = await service.resolveByCode(tenantId, 'abc1234567', owner);

      expect(result).toEqual({ projectId, viewId: 'v1' });
    });

    it('他人の private は存在を秘して NotFound', async () => {
      mockQueryBuilder({ ...baseView });

      await expect(service.resolveByCode(tenantId, 'abc1234567', other)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('未知のコードは NotFound', async () => {
      mockQueryBuilder(null);

      await expect(service.resolveByCode(tenantId, 'zzzzzzzzzz', owner)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('owner 本人は削除できる', async () => {
      repo.findOne.mockResolvedValue({ ...baseView });

      await service.remove(tenantId, projectId, 'v1', owner);

      expect(repo.remove).toHaveBeenCalled();
    });

    it('他人の private は NotFound', async () => {
      repo.findOne.mockResolvedValue({ ...baseView });

      await expect(service.remove(tenantId, projectId, 'v1', other)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
