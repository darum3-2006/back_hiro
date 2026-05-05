import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { TaskStatus } from './task-status.entity';
import { TaskStatusesService } from './task-statuses.service';

describe('TaskStatusesService', () => {
  let service: TaskStatusesService;
  let repo: jest.Mocked<Repository<TaskStatus>>;
  let projects: jest.Mocked<Pick<ProjectsService, 'findByIdInTenant'>>;

  const tenantId = 'tenant-1';
  const projectId = 'project-1';

  beforeEach(async () => {
    projects = {
      findByIdInTenant: jest.fn().mockResolvedValue({ id: projectId } as Project),
    };

    const qb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ maxOrder: 3 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskStatusesService,
        {
          provide: getRepositoryToken(TaskStatus),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn((dto: Partial<TaskStatus>) => dto as TaskStatus),
            save: jest.fn((entity: TaskStatus) => Promise.resolve(entity)),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(() => qb),
          },
        },
        { provide: ProjectsService, useValue: projects },
      ],
    }).compile();

    service = module.get(TaskStatusesService);
    repo = module.get(getRepositoryToken(TaskStatus));
  });

  describe('listByProject', () => {
    it('プロジェクトのステータスを order 昇順で返す', async () => {
      const items = [{ id: 's1', projectId, code: 'a', order: 1 }] as TaskStatus[];
      repo.find.mockResolvedValue(items);

      const result = await service.listByProject(tenantId, projectId);

      expect(result).toBe(items);
      expect(projects.findByIdInTenant).toHaveBeenCalledWith(tenantId, projectId);
      expect(repo.find).toHaveBeenCalledWith({
        where: { projectId },
        order: { order: 'ASC' },
      });
    });
  });

  describe('create', () => {
    it('order は max+1 で採番', async () => {
      const result = await service.create(tenantId, projectId, {
        label: 'Done',
        color: 'success',
        isTerminal: true,
      });

      expect(result.order).toBe(4);
      expect(result.code).toMatch(/^s_/);
      expect(result.isTerminal).toBe(true);
      expect(result.color).toBe('success');
    });

    it('label は trim される', async () => {
      const result = await service.create(tenantId, projectId, {
        label: '  todo  ',
        color: 'neutral',
        isTerminal: false,
      });

      expect(result.label).toBe('todo');
    });
  });

  describe('update', () => {
    it('部分更新が反映される', async () => {
      repo.findOne.mockResolvedValue({
        id: 's1',
        projectId,
        code: 'a',
        label: 'old',
        color: 'neutral',
        order: 1,
        isTerminal: false,
      } as TaskStatus);

      const result = await service.update(tenantId, projectId, 'a', {
        label: 'new',
        isTerminal: true,
      });

      expect(result.label).toBe('new');
      expect(result.isTerminal).toBe(true);
      expect(result.color).toBe('neutral');
    });

    it('存在しない code は NotFound', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update(tenantId, projectId, 'unknown', { label: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('対象を削除', async () => {
      const target = { id: 's1', projectId, code: 'a' } as TaskStatus;
      repo.findOne.mockResolvedValue(target);

      await service.remove(tenantId, projectId, 'a');

      expect(repo.remove).toHaveBeenCalledWith(target);
    });

    it('存在しない code は NotFound', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove(tenantId, projectId, 'unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
