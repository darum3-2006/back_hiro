import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { TASK_VIEW_HISTORY_LIMIT, TaskView } from './task-view.entity';
import { Task } from './task.entity';
import { TaskViewsService } from './task-views.service';

describe('TaskViewsService', () => {
  let service: TaskViewsService;
  let views: jest.Mocked<Repository<TaskView>>;
  let tasks: jest.Mocked<Repository<Task>>;
  const projects = { findByIdInTenant: jest.fn().mockResolvedValue({}) };

  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const projectId = 'project-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskViewsService,
        {
          provide: getRepositoryToken(TaskView),
          useValue: {
            upsert: jest.fn(),
            find: jest.fn().mockResolvedValue([]),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Task), useValue: { findOne: jest.fn() } },
        { provide: ProjectsService, useValue: projects },
      ],
    }).compile();

    service = module.get(TaskViewsService);
    views = module.get(getRepositoryToken(TaskView));
    tasks = module.get(getRepositoryToken(Task));
  });

  describe('record', () => {
    it('プロジェクトに無いタスクは 404（見えないタスクの閲覧を記録させない）', async () => {
      tasks.findOne.mockResolvedValue(null);

      await expect(service.record(tenantId, userId, projectId, 'task-x')).rejects.toThrow(
        NotFoundException,
      );
      expect(views.upsert).not.toHaveBeenCalled();
    });

    it('(user, task) で上書きし、同じタスクを何度開いても行を増やさない', async () => {
      tasks.findOne.mockResolvedValue({ id: 'task-1' } as Task);

      await service.record(tenantId, userId, projectId, 'task-1');

      expect(views.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId, userId, taskId: 'task-1' }),
        { conflictPaths: ['userId', 'taskId'] },
      );
    });

    it('上限を超えた古い分を消す（LIMIT なしの OFFSET は MySQL で通らないので take も付ける）', async () => {
      tasks.findOne.mockResolvedValue({ id: 'task-1' } as Task);
      views.find.mockResolvedValue([{ id: 'old-1' }, { id: 'old-2' }] as TaskView[]);

      await service.record(tenantId, userId, projectId, 'task-1');

      expect(views.find).toHaveBeenCalledWith(
        expect.objectContaining({ skip: TASK_VIEW_HISTORY_LIMIT, take: expect.any(Number) }),
      );
      expect(views.delete).toHaveBeenCalled();
    });

    it('上限以内なら何も消さない', async () => {
      tasks.findOne.mockResolvedValue({ id: 'task-1' } as Task);
      views.find.mockResolvedValue([]);

      await service.record(tenantId, userId, projectId, 'task-1');

      expect(views.delete).not.toHaveBeenCalled();
    });
  });

  describe('listMine', () => {
    it('閲覧できるプロジェクトが 0 件なら DB を引かない', async () => {
      const result = await service.listMine(tenantId, userId, []);

      expect(result).toEqual([]);
      expect(views.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('削除済みタスク・アーカイブ済みプロジェクトを除き、新しい順に上限件数まで返す', async () => {
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ shortCode: 'a', seq: '7' }]),
      };
      views.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.listMine(tenantId, userId, null);

      expect(qb.innerJoin).toHaveBeenCalledWith(
        Task,
        't',
        't.id = v.task_id AND t.deleted_at IS NULL',
      );
      expect(qb.andWhere).toHaveBeenCalledWith('p.archived_at IS NULL');
      expect(qb.orderBy).toHaveBeenCalledWith('v.viewed_at', 'DESC');
      expect(qb.limit).toHaveBeenCalledWith(TASK_VIEW_HISTORY_LIMIT);
      expect(result).toEqual([{ shortCode: 'a', seq: 7 }]);
    });
  });
});
