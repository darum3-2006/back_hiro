import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { Task } from '../tasks/task.entity';
import { TaskRelation } from './task-relation.entity';
import { TaskRelationsService } from './task-relations.service';

describe('TaskRelationsService', () => {
  let service: TaskRelationsService;
  let relationsRepo: jest.Mocked<
    Pick<Repository<TaskRelation>, 'find' | 'findOne' | 'create' | 'save' | 'remove'>
  >;
  let tasksRepo: jest.Mocked<Pick<Repository<Task>, 'find' | 'findOne'>>;

  const tenantId = 'tenant-1';
  const projectId = 'project-1';
  const taskId = 'task-A';
  const otherId = 'task-B';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskRelationsService,
        {
          provide: getRepositoryToken(TaskRelation),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn((d: Partial<TaskRelation>) => d as TaskRelation),
            save: jest.fn((e: TaskRelation) => Promise.resolve({ ...e, id: e.id ?? 'rel-1' })),
            remove: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Task),
          useValue: {
            find: jest
              .fn()
              .mockResolvedValue([{ id: otherId, seq: 12, content: '相手', statusCode: 'todo' }]),
            findOne: jest.fn().mockResolvedValue({ id: 'x' }),
          },
        },
        {
          provide: ProjectsService,
          useValue: { findByIdInTenant: jest.fn().mockResolvedValue({ id: projectId } as Project) },
        },
      ],
    }).compile();

    service = module.get(TaskRelationsService);
    relationsRepo = module.get(getRepositoryToken(TaskRelation));
    tasksRepo = module.get(getRepositoryToken(Task));
  });

  describe('create', () => {
    it('successor は precedes(source=this, target=other) に正規化する', async () => {
      await service.create(tenantId, projectId, taskId, {
        otherTaskId: otherId,
        kind: 'successor',
      });

      expect(relationsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId,
          sourceTaskId: taskId,
          targetTaskId: otherId,
          type: 'precedes',
        }),
      );
    });

    it('predecessor は precedes(source=other, target=this) に正規化する', async () => {
      await service.create(tenantId, projectId, taskId, {
        otherTaskId: otherId,
        kind: 'predecessor',
      });

      expect(relationsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sourceTaskId: otherId, targetTaskId: taskId, type: 'precedes' }),
      );
    });

    it('blocked_by は blocks(source=other, target=this) に正規化する', async () => {
      await service.create(tenantId, projectId, taskId, {
        otherTaskId: otherId,
        kind: 'blocked_by',
      });

      expect(relationsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sourceTaskId: otherId, targetTaskId: taskId, type: 'blocks' }),
      );
    });

    it('自分自身との関連は 400', async () => {
      await expect(
        service.create(tenantId, projectId, taskId, { otherTaskId: taskId, kind: 'related' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('重複する関連は 409', async () => {
      relationsRepo.findOne.mockResolvedValue({ id: 'dup' } as TaskRelation);

      await expect(
        service.create(tenantId, projectId, taskId, { otherTaskId: otherId, kind: 'related' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('listForTask', () => {
    it('precedes の向きに応じて successor / predecessor に振り分ける', async () => {
      relationsRepo.find.mockResolvedValue([
        { id: 'r1', sourceTaskId: taskId, targetTaskId: otherId, type: 'precedes' } as TaskRelation,
        { id: 'r2', sourceTaskId: otherId, targetTaskId: taskId, type: 'precedes' } as TaskRelation,
      ]);
      tasksRepo.find.mockResolvedValue([
        { id: otherId, seq: 12, content: '相手', statusCode: 'todo' } as Task,
      ]);

      const result = await service.listForTask(tenantId, projectId, taskId);

      expect(result.find((r) => r.id === 'r1')?.kind).toBe('successor');
      expect(result.find((r) => r.id === 'r2')?.kind).toBe('predecessor');
    });
  });
});
