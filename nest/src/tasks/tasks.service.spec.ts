import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { Tag } from '../masters/tag.entity';
import { TaskStatus } from '../masters/task-status.entity';
import type { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { TaskTag } from './task-tag.entity';
import { Task } from './task.entity';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  let tasksRepo: jest.Mocked<Repository<Task>>;
  let projects: jest.Mocked<Pick<ProjectsService, 'findByIdInTenant'>>;

  const tenantId = 'tenant-1';
  const projectId = 'project-1';

  const baseTask: Task = {
    id: 't1',
    projectId,
    seq: 1,
    content: 'タスク',
    description: '',
    links: [],
    statusCode: 'todo',
    priorityCode: null,
    assigneeMemberId: null,
    requesterMemberId: null,
    requestingDeptCode: null,
    deadline: null,
    plannedCompletionDate: null,
    plannedReleaseDate: null,
    completedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
  } as Task;

  let statusesRepo: jest.Mocked<Pick<Repository<TaskStatus>, 'findOne'>>;

  beforeEach(async () => {
    projects = {
      findByIdInTenant: jest.fn().mockResolvedValue({ id: projectId } as Project),
    };

    const seqQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ maxSeq: 5 }),
    };

    const tagQb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    const filterQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        {
          provide: getRepositoryToken(Task),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn((dto: Partial<Task>) => dto as Task),
            save: jest.fn((entity: Task) => Promise.resolve({ ...entity, id: entity.id ?? 't1' })),
            remove: jest.fn(),
            createQueryBuilder: jest.fn((alias?: string) => {
              if (alias === 't') {
                // 用途で使い分け
                return {
                  ...seqQb,
                  ...filterQb,
                  // seq 用 select / where 経由は seqQb のメソッドを返す
                };
              }
              return seqQb;
            }),
          },
        },
        {
          provide: getRepositoryToken(TaskTag),
          useValue: {
            manager: {
              transaction: jest.fn(async (cb: (em: unknown) => Promise<unknown>) => cb({})),
            },
            createQueryBuilder: jest.fn(() => tagQb),
            delete: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Tag),
          useValue: { find: jest.fn() },
        },
        {
          provide: getRepositoryToken(TaskStatus),
          useValue: { findOne: jest.fn().mockResolvedValue(null) },
        },
        { provide: ProjectsService, useValue: projects },
      ],
    }).compile();

    service = module.get(TasksService);
    tasksRepo = module.get(getRepositoryToken(Task));
    statusesRepo = module.get(getRepositoryToken(TaskStatus));
  });

  describe('findInProject', () => {
    it('該当プロジェクトに存在しなければ NotFound', async () => {
      tasksRepo.findOne.mockResolvedValue(null);

      await expect(service.findInProject(tenantId, projectId, 'unknown')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('存在すれば tagCodes 付きで返す', async () => {
      tasksRepo.findOne.mockResolvedValue({ ...baseTask });

      const result = await service.findInProject(tenantId, projectId, 't1');

      expect(result.id).toBe('t1');
      expect(result.tagCodes).toEqual([]);
    });
  });

  describe('remove', () => {
    it('対象を削除', async () => {
      tasksRepo.findOne.mockResolvedValue({ ...baseTask });

      await service.remove(tenantId, projectId, 't1');

      expect(tasksRepo.remove).toHaveBeenCalled();
    });

    it('存在しなければ NotFound', async () => {
      tasksRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(tenantId, projectId, 'unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('content の trim と部分更新', async () => {
      const target = { ...baseTask, content: 'old' };
      tasksRepo.findOne
        .mockResolvedValueOnce(target as Task)
        .mockResolvedValueOnce({ ...target, content: 'new' } as Task);

      const result = await service.update(tenantId, projectId, 't1', { content: '  new  ' });

      expect(result.content).toBe('new');
    });

    it('存在しない id は NotFound', async () => {
      tasksRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(tenantId, projectId, 'unknown', { content: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('non-terminal -> terminal で completedAt が現在時刻にセットされる', async () => {
      const target: Task = { ...baseTask, statusCode: 'todo', completedAt: null };
      tasksRepo.findOne
        .mockResolvedValueOnce(target)
        .mockResolvedValueOnce({ ...target, statusCode: 'done' });
      statusesRepo.findOne.mockImplementation(({ where }) => {
        const code = (where as { code: string }).code;
        return Promise.resolve({
          isTerminal: code === 'done',
        } as TaskStatus);
      });

      await service.update(tenantId, projectId, 't1', { statusCode: 'done' });

      const saved = tasksRepo.save.mock.calls[0]![0] as Task;
      expect(saved.statusCode).toBe('done');
      expect(saved.completedAt).toBeInstanceOf(Date);
    });

    it('terminal -> 別の terminal で completedAt が上書きされる', async () => {
      const old = new Date('2026-01-01');
      const target: Task = { ...baseTask, statusCode: 'done', completedAt: old };
      tasksRepo.findOne
        .mockResolvedValueOnce(target)
        .mockResolvedValueOnce({ ...target, statusCode: 'archived' });
      statusesRepo.findOne.mockResolvedValue({ isTerminal: true } as TaskStatus);

      await service.update(tenantId, projectId, 't1', { statusCode: 'archived' });

      const saved = tasksRepo.save.mock.calls[0]![0] as Task;
      expect(saved.completedAt).toBeInstanceOf(Date);
      expect(saved.completedAt!.getTime()).toBeGreaterThan(old.getTime());
    });

    it('terminal -> non-terminal で completedAt が null になる', async () => {
      const target: Task = {
        ...baseTask,
        statusCode: 'done',
        completedAt: new Date('2026-01-01'),
      };
      tasksRepo.findOne
        .mockResolvedValueOnce(target)
        .mockResolvedValueOnce({ ...target, statusCode: 'todo', completedAt: null });
      statusesRepo.findOne.mockImplementation(({ where }) => {
        const code = (where as { code: string }).code;
        return Promise.resolve({
          isTerminal: code === 'done',
        } as TaskStatus);
      });

      await service.update(tenantId, projectId, 't1', { statusCode: 'todo' });

      const saved = tasksRepo.save.mock.calls[0]![0] as Task;
      expect(saved.completedAt).toBeNull();
    });

    it('statusCode 未指定なら completedAt に触れない', async () => {
      const completed = new Date('2026-01-01');
      const target: Task = { ...baseTask, statusCode: 'done', completedAt: completed };
      tasksRepo.findOne.mockResolvedValueOnce(target).mockResolvedValueOnce(target);

      await service.update(tenantId, projectId, 't1', { content: 'x' });

      const saved = tasksRepo.save.mock.calls[0]![0] as Task;
      expect(saved.completedAt).toBe(completed);
      expect(statusesRepo.findOne).not.toHaveBeenCalled();
    });
  });
});
