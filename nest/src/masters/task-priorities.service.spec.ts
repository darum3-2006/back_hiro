import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { TaskPriority } from './task-priority.entity';
import { TaskPrioritiesService } from './task-priorities.service';

describe('TaskPrioritiesService', () => {
  let service: TaskPrioritiesService;
  let repo: jest.Mocked<Repository<TaskPriority>>;
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
      getRawOne: jest.fn().mockResolvedValue({ maxOrder: null }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskPrioritiesService,
        {
          provide: getRepositoryToken(TaskPriority),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn((dto: Partial<TaskPriority>) => dto as TaskPriority),
            save: jest.fn((entity: TaskPriority) => Promise.resolve(entity)),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(() => qb),
          },
        },
        { provide: ProjectsService, useValue: projects },
      ],
    }).compile();

    service = module.get(TaskPrioritiesService);
    repo = module.get(getRepositoryToken(TaskPriority));
  });

  describe('create', () => {
    it('空テーブルでは order=1 で採番', async () => {
      const result = await service.create(tenantId, projectId, {
        label: 'High',
        color: 'error',
      });

      expect(result.order).toBe(1);
      expect(result.code).toMatch(/^p_/);
    });
  });

  describe('update', () => {
    it('label のみ更新', async () => {
      repo.findOne.mockResolvedValue({
        id: 'p1',
        projectId,
        code: 'a',
        label: 'old',
        color: 'neutral',
        order: 1,
      } as TaskPriority);

      const result = await service.update(tenantId, projectId, 'a', { label: 'new' });

      expect(result.label).toBe('new');
      expect(result.color).toBe('neutral');
    });

    it('存在しない code は NotFound', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update(tenantId, projectId, 'unknown', { label: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
