import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError, type Repository } from 'typeorm';
import type { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { ProjectMember } from './member.entity';
import { MembersService } from './members.service';

describe('MembersService', () => {
  let service: MembersService;
  let repo: jest.Mocked<Repository<ProjectMember>>;
  let projects: jest.Mocked<Pick<ProjectsService, 'findByIdInTenant'>>;

  const tenantId = 'tenant-1';
  const projectId = 'project-1';

  const baseMember: ProjectMember = {
    id: 'm1',
    projectId,
    userId: null,
    user: null,
    project: { id: projectId } as Project,
    displayName: 'Old Name',
    role: 'member',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
  } as ProjectMember;

  beforeEach(async () => {
    projects = {
      findByIdInTenant: jest.fn().mockResolvedValue({ id: projectId } as Project),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MembersService,
        {
          provide: getRepositoryToken(ProjectMember),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn((dto: Partial<ProjectMember>) => dto as ProjectMember),
            save: jest.fn((entity: ProjectMember) => Promise.resolve(entity)),
            remove: jest.fn(),
          },
        },
        { provide: ProjectsService, useValue: projects },
      ],
    }).compile();

    service = module.get(MembersService);
    repo = module.get(getRepositoryToken(ProjectMember));
  });

  describe('listByProject', () => {
    it('プロジェクトのメンバー一覧を createdAt 昇順で返す', async () => {
      const items = [baseMember];
      repo.find.mockResolvedValue(items);

      const result = await service.listByProject(tenantId, projectId);

      expect(result).toBe(items);
      expect(projects.findByIdInTenant).toHaveBeenCalledWith(tenantId, projectId);
      expect(repo.find).toHaveBeenCalledWith({
        where: { projectId },
        order: { createdAt: 'ASC' },
      });
    });

    it('別テナントのプロジェクトは見えない（プロジェクト側で NotFound）', async () => {
      projects.findByIdInTenant.mockRejectedValue(new NotFoundException());

      await expect(service.listByProject(tenantId, projectId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('userId 省略時は null で保存', async () => {
      const result = await service.create(tenantId, projectId, {
        displayName: '田中',
        role: 'admin',
      });

      expect(result.userId).toBeNull();
      expect(result.displayName).toBe('田中');
      expect(result.role).toBe('admin');
      expect(result.projectId).toBe(projectId);
    });

    it('displayName は trim される', async () => {
      const result = await service.create(tenantId, projectId, {
        displayName: '  山田  ',
        role: 'member',
      });

      expect(result.displayName).toBe('山田');
    });

    it('一意制約違反は ConflictException に変換', async () => {
      const dup = new QueryFailedError('q', [], new Error('dup'));
      (dup as QueryFailedError & { driverError: { code: string } }).driverError = {
        code: 'ER_DUP_ENTRY',
      };
      repo.save.mockRejectedValue(dup);

      await expect(
        service.create(tenantId, projectId, {
          displayName: '田中',
          userId: 'user-1',
          role: 'member',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('bulkCreate', () => {
    it('空行を除外し、trim・userId=null・指定 role で一括作成', async () => {
      const result = await service.bulkCreate(
        tenantId,
        projectId,
        ['  田中  ', '', '  ', '佐藤'],
        'member',
      );

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.displayName)).toEqual(['田中', '佐藤']);
      expect(result.every((m) => m.userId === null)).toBe(true);
      expect(result.every((m) => m.role === 'member')).toBe(true);
      expect(result.every((m) => m.projectId === projectId)).toBe(true);
    });

    it('有効な行が無ければ BadRequest', async () => {
      await expect(service.bulkCreate(tenantId, projectId, ['', '   '], 'member')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    it('部分更新が反映される', async () => {
      repo.findOne.mockResolvedValue({ ...baseMember });

      const result = await service.update(tenantId, projectId, 'm1', {
        displayName: '新しい名前',
        role: 'admin',
      });

      expect(result.displayName).toBe('新しい名前');
      expect(result.role).toBe('admin');
    });

    it('userId: null で User 紐付け解除', async () => {
      repo.findOne.mockResolvedValue({ ...baseMember, userId: 'user-1' } as ProjectMember);

      const result = await service.update(tenantId, projectId, 'm1', { userId: null });

      expect(result.userId).toBeNull();
    });

    it('存在しない id は NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update(tenantId, projectId, 'unknown', { displayName: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('対象を削除する', async () => {
      repo.findOne.mockResolvedValue({ ...baseMember });

      await service.remove(tenantId, projectId, 'm1');

      expect(repo.remove).toHaveBeenCalled();
    });

    it('存在しなければ NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove(tenantId, projectId, 'unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
