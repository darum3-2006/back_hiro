import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { Department } from '../departments/department.entity';
import { ProjectMember } from '../members/member.entity';
import { Tag } from '../masters/tag.entity';
import { TaskPriority } from '../masters/task-priority.entity';
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
  let audit: jest.Mocked<Pick<AuditService, 'record' | 'listForEntity'>>;
  let em: { save: jest.Mock<Promise<Task>, [Task]>; remove: jest.Mock; getRepository: jest.Mock };

  const tenantId = 'tenant-1';
  const projectId = 'project-1';
  const actor = 'user-1';

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

  let statusesRepo: jest.Mocked<Pick<Repository<TaskStatus>, 'findOne' | 'find'>>;

  beforeEach(async () => {
    projects = {
      findByIdInTenant: jest.fn().mockResolvedValue({ id: projectId } as Project),
    };
    audit = { record: jest.fn(), listForEntity: jest.fn().mockResolvedValue([]) };

    // 監査記録・タグ置換は呼び出し側トランザクション内で行うため、共有 em を用意。
    const tagEm = { find: jest.fn().mockResolvedValue([]) };
    const taskTagEm = { delete: jest.fn(), save: jest.fn(), create: jest.fn((x: unknown) => x) };
    em = {
      save: jest.fn((e: Task): Promise<Task> => Promise.resolve({ ...e, id: e.id ?? 't1' })),
      remove: jest.fn(),
      getRepository: jest.fn((entity: unknown) => (entity === Tag ? tagEm : taskTagEm)),
    };
    const transaction = jest.fn(async (cb: (m: EntityManager) => Promise<unknown>) =>
      cb(em as unknown as EntityManager),
    );

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
            manager: { transaction },
            findOne: jest.fn(),
            create: jest.fn((dto: Partial<Task>) => dto as Task),
            save: jest.fn((entity: Task) => Promise.resolve({ ...entity, id: entity.id ?? 't1' })),
            remove: jest.fn(),
            createQueryBuilder: jest.fn((alias?: string) => {
              if (alias === 't') return { ...seqQb, ...filterQb };
              return seqQb;
            }),
          },
        },
        {
          provide: getRepositoryToken(TaskTag),
          useValue: {
            manager: { transaction },
            createQueryBuilder: jest.fn(() => tagQb),
            delete: jest.fn(),
            save: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Tag), useValue: { find: jest.fn().mockResolvedValue([]) } },
        {
          provide: getRepositoryToken(TaskStatus),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(TaskPriority),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(ProjectMember),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Department),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        { provide: ProjectsService, useValue: projects },
        { provide: AuditService, useValue: audit },
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

  describe('search', () => {
    it('空クエリは即 [] を返す（DB を引かない）', async () => {
      const result = await service.search(tenantId, '   ');
      expect(result).toEqual([]);
      expect(tasksRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('結果をマップし seq を数値化する', async () => {
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            shortCode: 'abc',
            seq: '15',
            content: 'ログイン不具合',
            statusCode: 'doing',
            statusLabel: '対応中',
            projectId: 'p1',
            projectName: 'PJ',
          },
        ]),
      };
      tasksRepo.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.search(tenantId, 'ログイン');

      expect(result).toEqual([
        {
          shortCode: 'abc',
          seq: 15,
          content: 'ログイン不具合',
          statusCode: 'doing',
          statusLabel: '対応中',
          projectId: 'p1',
          projectName: 'PJ',
        },
      ]);
      expect(qb.andWhere).toHaveBeenCalledWith('p.archived_at IS NULL');
    });

    it('#15 のような数値は seq 条件を含める', async () => {
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      };
      tasksRepo.createQueryBuilder.mockReturnValue(qb as never);

      await service.search(tenantId, '#15');

      const calls = qb.andWhere.mock.calls as Array<[string, Record<string, unknown>?]>;
      const usedSeq = calls.some((c) => c[1]?.seq === 15);
      expect(usedSeq).toBe(true);
    });
  });

  describe('remove', () => {
    it('対象を削除し監査ログ(delete)を記録', async () => {
      tasksRepo.findOne.mockResolvedValue({ ...baseTask });

      await service.remove(tenantId, projectId, 't1', actor);

      expect(em.remove).toHaveBeenCalled();
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'task',
          entityId: 't1',
          action: 'delete',
          actorUserId: actor,
        }),
        expect.anything(),
      );
    });

    it('存在しなければ NotFound', async () => {
      tasksRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(tenantId, projectId, 'unknown', actor)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('content の trim と部分更新、監査ログ(update)を記録', async () => {
      const target = { ...baseTask, content: 'old' };
      tasksRepo.findOne
        .mockResolvedValueOnce(target as Task)
        .mockResolvedValueOnce({ ...target, content: 'new' } as Task);

      const result = await service.update(tenantId, projectId, 't1', { content: '  new  ' }, actor);

      expect(result.content).toBe('new');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          changes: expect.arrayContaining([
            expect.objectContaining({ field: 'content', old: 'old', new: 'new' }),
          ]),
          actorUserId: actor,
        }),
        expect.anything(),
      );
    });

    it('実質変更がなければ監査ログを記録しない', async () => {
      const target = { ...baseTask, content: 'same' };
      tasksRepo.findOne.mockResolvedValueOnce(target as Task).mockResolvedValueOnce(target as Task);

      await service.update(tenantId, projectId, 't1', { content: 'same' }, actor);

      expect(audit.record).not.toHaveBeenCalled();
    });

    it('存在しない id は NotFound', async () => {
      tasksRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update(tenantId, projectId, 'unknown', { content: 'x' }, actor),
      ).rejects.toThrow(NotFoundException);
    });

    it('non-terminal -> terminal で completedAt が現在時刻にセットされる', async () => {
      const target: Task = { ...baseTask, statusCode: 'todo', completedAt: null };
      tasksRepo.findOne
        .mockResolvedValueOnce(target)
        .mockResolvedValueOnce({ ...target, statusCode: 'done' });
      statusesRepo.findOne.mockImplementation(({ where }) => {
        const code = (where as { code: string }).code;
        return Promise.resolve({ isTerminal: code === 'done' } as TaskStatus);
      });

      await service.update(tenantId, projectId, 't1', { statusCode: 'done' }, actor);

      const saved = em.save.mock.calls[0]![0];
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

      await service.update(tenantId, projectId, 't1', { statusCode: 'archived' }, actor);

      const saved = em.save.mock.calls[0]![0];
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
        return Promise.resolve({ isTerminal: code === 'done' } as TaskStatus);
      });

      await service.update(tenantId, projectId, 't1', { statusCode: 'todo' }, actor);

      const saved = em.save.mock.calls[0]![0];
      expect(saved.completedAt).toBeNull();
    });

    it('statusCode 未指定なら completedAt に触れない', async () => {
      const completed = new Date('2026-01-01');
      const target: Task = { ...baseTask, statusCode: 'done', completedAt: completed };
      tasksRepo.findOne.mockResolvedValueOnce(target).mockResolvedValueOnce(target);

      await service.update(tenantId, projectId, 't1', { content: 'x' }, actor);

      const saved = em.save.mock.calls[0]![0];
      expect(saved.completedAt).toBe(completed);
      expect(statusesRepo.findOne).not.toHaveBeenCalled();
    });
  });
});
