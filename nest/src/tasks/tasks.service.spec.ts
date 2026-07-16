import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { Comment } from '../comments/comment.entity';
import { Department } from '../departments/department.entity';
import { ProjectMember } from '../members/member.entity';
import { Flag } from '../masters/flag.entity';
import { Tag } from '../masters/tag.entity';
import { TaskPriority } from '../masters/task-priority.entity';
import { TaskStatus } from '../masters/task-status.entity';
import type { Project } from '../projects/project.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectsService } from '../projects/projects.service';
import { SlackService } from '../slack/slack.service';
import { Subtask } from '../subtasks/subtask.entity';
import { TaskFlag } from './task-flag.entity';
import { TaskTag } from './task-tag.entity';
import { Task } from './task.entity';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  let tasksRepo: jest.Mocked<Repository<Task>>;
  let projects: jest.Mocked<Pick<ProjectsService, 'findByIdInTenant'>>;
  let audit: jest.Mocked<Pick<AuditService, 'record' | 'listForEntity'>>;
  let em: { save: jest.Mock<Promise<Task>, [Task]>; remove: jest.Mock; getRepository: jest.Mock };
  let filterQb: {
    where: jest.Mock;
    andWhere: jest.Mock;
    leftJoin: jest.Mock;
    orderBy: jest.Mock;
    getMany: jest.Mock;
    getCount: jest.Mock;
  };
  // getTagCodes が使う taskTags.createQueryBuilder の返り値（テストから差し替える）
  let tagQb: {
    innerJoin: jest.Mock;
    select: jest.Mock;
    where: jest.Mock;
    getRawMany: jest.Mock;
  };

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
    plannedStartDate: null,
    plannedCompletionDate: null,
    plannedReleaseDate: null,
    completedAt: null,
    statusChangedAt: new Date('2026-01-01'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
  } as Task;

  let statusesRepo: jest.Mocked<Pick<Repository<TaskStatus>, 'findOne' | 'find'>>;
  let subtasksRepo: jest.Mocked<Pick<Repository<Subtask>, 'count'>>;
  let membersRepo: jest.Mocked<Pick<Repository<ProjectMember>, 'find' | 'findOne'>>;
  let slack: {
    notifyTaskCreated: jest.Mock;
    notifyTaskStatusChanged: jest.Mock;
    notifyTaskCompleted: jest.Mock;
  };

  beforeEach(async () => {
    projects = {
      findByIdInTenant: jest.fn().mockResolvedValue({ id: projectId } as Project),
    };
    audit = { record: jest.fn(), listForEntity: jest.fn().mockResolvedValue([]) };

    // 監査記録・タグ/フラグ置換は呼び出し側トランザクション内で行うため、共有 em を用意。
    const tagEm = { find: jest.fn().mockResolvedValue([]) };
    const taskTagEm = { delete: jest.fn(), save: jest.fn(), create: jest.fn((x: unknown) => x) };
    const flagEm = { find: jest.fn().mockResolvedValue([]) };
    const taskFlagEm = { delete: jest.fn(), save: jest.fn(), create: jest.fn((x: unknown) => x) };
    em = {
      save: jest.fn((e: Task): Promise<Task> => Promise.resolve({ ...e, id: e.id ?? 't1' })),
      remove: jest.fn(),
      getRepository: jest.fn((entity: unknown) =>
        entity === Tag
          ? tagEm
          : entity === Flag
            ? flagEm
            : entity === TaskFlag
              ? taskFlagEm
              : taskTagEm,
      ),
    };
    const transaction = jest.fn(async (cb: (m: EntityManager) => Promise<unknown>) =>
      cb(em as unknown as EntityManager),
    );

    const seqQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ maxSeq: 5 }),
    };
    tagQb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const flagJoinQb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const commentsQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    filterQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
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
        { provide: getRepositoryToken(Flag), useValue: { find: jest.fn().mockResolvedValue([]) } },
        {
          provide: getRepositoryToken(TaskFlag),
          useValue: {
            manager: { transaction },
            createQueryBuilder: jest.fn(() => flagJoinQb),
            delete: jest.fn(),
            save: jest.fn(),
          },
        },
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
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: getRepositoryToken(Department),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Comment),
          useValue: { createQueryBuilder: jest.fn(() => commentsQb) },
        },
        {
          provide: getRepositoryToken(Subtask),
          useValue: { count: jest.fn().mockResolvedValue(0) },
        },
        { provide: ProjectsService, useValue: projects },
        { provide: AuditService, useValue: audit },
        {
          provide: NotificationsService,
          useValue: { onTaskCreated: jest.fn(), onTaskChanged: jest.fn() },
        },
        {
          provide: SlackService,
          useValue: {
            notifyTaskCreated: jest.fn(),
            notifyTaskStatusChanged: jest.fn(),
            notifyTaskCompleted: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(TasksService);
    tasksRepo = module.get(getRepositoryToken(Task));
    statusesRepo = module.get(getRepositoryToken(TaskStatus));
    subtasksRepo = module.get(getRepositoryToken(Subtask));
    membersRepo = module.get(getRepositoryToken(ProjectMember));
    slack = module.get(SlackService);
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

  describe('listByProject', () => {
    const TERMINAL_CONDITION = '(s.is_terminal IS NULL OR s.is_terminal = false)';

    it('既定では完了（終端ステータス）タスクを除外する', async () => {
      await service.listByProject(tenantId, projectId);

      expect(filterQb.leftJoin).toHaveBeenCalledWith(
        TaskStatus,
        's',
        's.project_id = t.project_id AND s.code = t.status_code',
      );
      expect(filterQb.andWhere).toHaveBeenCalledWith(TERMINAL_CONDITION);
    });

    it('includeCompleted=true なら終端ステータスを除外しない', async () => {
      await service.listByProject(tenantId, projectId, { includeCompleted: true });

      expect(filterQb.leftJoin).not.toHaveBeenCalled();
      expect(filterQb.andWhere).not.toHaveBeenCalledWith(TERMINAL_CONDITION);
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

  describe('listMyOpenTasks', () => {
    it('生の行を返し seq を数値化する', async () => {
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([
          {
            shortCode: 'abc',
            seq: '12',
            content: '対応',
            statusCode: 'doing',
            statusLabel: '対応中',
            statusColor: 'info',
            priorityCode: null,
            deadline: '2026-06-30',
            projectId: 'p1',
            projectName: 'PJ',
          },
        ]),
      };
      tasksRepo.createQueryBuilder.mockReturnValue(qb as never);

      const result = await service.listMyOpenTasks(tenantId, 'user-1');

      expect(result).toEqual([
        {
          shortCode: 'abc',
          seq: 12,
          content: '対応',
          statusCode: 'doing',
          statusLabel: '対応中',
          statusColor: 'info',
          priorityCode: null,
          deadline: '2026-06-30',
          projectId: 'p1',
          projectName: 'PJ',
        },
      ]);
      expect(qb.andWhere).toHaveBeenCalledWith('am.user_id = :userId', { userId: 'user-1' });
      expect(qb.andWhere).toHaveBeenCalledWith('s.is_terminal = false');
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

  describe('create', () => {
    it('statusChangedAt を作成時刻でセットする', async () => {
      tasksRepo.findOne
        .mockResolvedValueOnce(null) // nextShortCode: 採番コードは未使用
        .mockResolvedValueOnce({ ...baseTask }); // 末尾 findInProject

      await service.create(tenantId, projectId, { content: 'x', statusCode: 'todo' }, actor);

      const saved = em.save.mock.calls[0]![0];
      expect(saved.statusChangedAt).toBeInstanceOf(Date);
    });

    it('readonly ユーザー紐づきメンバーは担当者にできない', async () => {
      membersRepo.findOne.mockResolvedValue({
        id: 'm1',
        projectId,
        user: { role: 'readonly' },
      } as ProjectMember);

      await expect(
        service.create(
          tenantId,
          projectId,
          { content: 'x', statusCode: 'todo', assigneeMemberId: 'm1' },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('readonly ユーザー紐づきメンバーでも依頼者には設定できる', async () => {
      membersRepo.findOne.mockResolvedValue({
        id: 'm1',
        projectId,
        user: { role: 'readonly' },
      } as ProjectMember);
      tasksRepo.findOne
        .mockResolvedValueOnce(null) // nextShortCode
        .mockResolvedValueOnce({ ...baseTask }); // 末尾 findInProject

      await expect(
        service.create(
          tenantId,
          projectId,
          { content: 'x', statusCode: 'todo', requesterMemberId: 'm1' },
          actor,
        ),
      ).resolves.toBeDefined();
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

    it('readonly ユーザー紐づきメンバーへの担当者変更は拒否', async () => {
      tasksRepo.findOne.mockResolvedValueOnce({ ...baseTask } as Task);
      membersRepo.findOne.mockResolvedValue({
        id: 'm1',
        projectId,
        user: { role: 'readonly' },
      } as ProjectMember);

      await expect(
        service.update(tenantId, projectId, 't1', { assigneeMemberId: 'm1' }, actor),
      ).rejects.toThrow(BadRequestException);
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

    it('ステータス変更時に statusChangedAt を更新する', async () => {
      const old = new Date('2026-01-01');
      const target: Task = { ...baseTask, statusCode: 'todo', statusChangedAt: old };
      tasksRepo.findOne
        .mockResolvedValueOnce(target)
        .mockResolvedValueOnce({ ...target, statusCode: 'doing' });
      statusesRepo.findOne.mockResolvedValue({ isTerminal: false } as TaskStatus);

      await service.update(tenantId, projectId, 't1', { statusCode: 'doing' }, actor);

      const saved = em.save.mock.calls[0]![0];
      expect(saved.statusChangedAt).toBeInstanceOf(Date);
      expect(saved.statusChangedAt.getTime()).toBeGreaterThan(old.getTime());
    });

    it('statusCode 未指定なら statusChangedAt に触れない', async () => {
      const changed = new Date('2026-01-01');
      const target: Task = { ...baseTask, statusChangedAt: changed };
      tasksRepo.findOne.mockResolvedValueOnce(target).mockResolvedValueOnce(target);

      await service.update(tenantId, projectId, 't1', { content: 'x' }, actor);

      const saved = em.save.mock.calls[0]![0];
      expect(saved.statusChangedAt).toBe(changed);
    });

    it('未完了→完了 で Slack の完了通知を送る（ステータス変更通知は送らない）', async () => {
      const target: Task = { ...baseTask, statusCode: 'todo', completedAt: null };
      tasksRepo.findOne
        .mockResolvedValueOnce(target)
        .mockResolvedValueOnce({ ...target, statusCode: 'done' });
      statusesRepo.findOne.mockImplementation(({ where }) => {
        const code = (where as { code: string }).code;
        return Promise.resolve({ isTerminal: code === 'done' } as TaskStatus);
      });

      await service.update(tenantId, projectId, 't1', { statusCode: 'done' }, actor);

      expect(slack.notifyTaskCompleted).toHaveBeenCalledTimes(1);
      expect(slack.notifyTaskStatusChanged).not.toHaveBeenCalled();
    });

    it('未完了サブタスクがある親を終端にしようとすると 400', async () => {
      const target: Task = { ...baseTask, statusCode: 'todo', completedAt: null };
      tasksRepo.findOne.mockResolvedValueOnce(target);
      statusesRepo.findOne.mockResolvedValue({ isTerminal: true } as TaskStatus);
      subtasksRepo.count.mockResolvedValue(2);

      await expect(
        service.update(tenantId, projectId, 't1', { statusCode: 'done' }, actor),
      ).rejects.toThrow('未完了のサブタスクが 2 件あります。先に完了してください');
      // 副作用前に弾く（保存しない）
      expect(em.save).not.toHaveBeenCalled();
    });

    it('サブタスクが全完了していれば親を終端にできる', async () => {
      const target: Task = { ...baseTask, statusCode: 'todo', completedAt: null };
      tasksRepo.findOne
        .mockResolvedValueOnce(target)
        .mockResolvedValueOnce({ ...target, statusCode: 'done' });
      statusesRepo.findOne.mockImplementation(({ where }) => {
        const code = (where as { code: string }).code;
        return Promise.resolve({ isTerminal: code === 'done' } as TaskStatus);
      });
      subtasksRepo.count.mockResolvedValue(0);

      await service.update(tenantId, projectId, 't1', { statusCode: 'done' }, actor);

      const saved = em.save.mock.calls[0]![0];
      expect(saved.statusCode).toBe('done');
    });

    it('非終端へのステータス変更では Slack のステータス変更通知を送る', async () => {
      const target: Task = { ...baseTask, statusCode: 'todo', completedAt: null };
      tasksRepo.findOne
        .mockResolvedValueOnce(target)
        .mockResolvedValueOnce({ ...target, statusCode: 'doing' });
      statusesRepo.findOne.mockResolvedValue({ isTerminal: false } as TaskStatus);

      await service.update(tenantId, projectId, 't1', { statusCode: 'doing' }, actor);

      expect(slack.notifyTaskStatusChanged).toHaveBeenCalledTimes(1);
      expect(slack.notifyTaskCompleted).not.toHaveBeenCalled();
    });
  });

  describe('bulkUpdate', () => {
    it('各 id へ update を適用し更新件数を返す', async () => {
      // update() は id ごとに findOne を 2 回呼ぶ（取得 + 末尾 findInProject）
      tasksRepo.findOne.mockImplementation(({ where }) => {
        const id = (where as { id: string }).id;
        return Promise.resolve({ ...baseTask, id, statusCode: 'todo' } as Task);
      });

      const result = await service.bulkUpdate(
        tenantId,
        projectId,
        { ids: ['a', 'b'], statusCode: 'doing' },
        actor,
      );

      expect(result).toEqual({ updated: 2 });
      expect(audit.record).toHaveBeenCalledTimes(2);
    });

    it('変更対象フィールドが無ければ何もしない（updated=0）', async () => {
      const result = await service.bulkUpdate(tenantId, projectId, { ids: ['a', 'b'] }, actor);

      expect(result).toEqual({ updated: 0 });
      expect(audit.record).not.toHaveBeenCalled();
    });

    it('存在しない id は NotFound を握りつぶしてスキップする', async () => {
      tasksRepo.findOne.mockResolvedValue(null);

      const result = await service.bulkUpdate(
        tenantId,
        projectId,
        { ids: ['ghost'], statusCode: 'doing' },
        actor,
      );

      expect(result).toEqual({ updated: 0 });
    });

    it('タグ add / remove 指定時は現在値の差分で tagCodes を組み立てて置換する', async () => {
      // getTagCodes は taskTags.createQueryBuilder(...).getRawMany() 経由。現在 ['x','y'] とする
      tagQb.getRawMany.mockResolvedValue([{ code: 'x' }, { code: 'y' }]);
      tasksRepo.findOne.mockImplementation(({ where }) => {
        const id = (where as { id: string }).id;
        return Promise.resolve({ ...baseTask, id } as Task);
      });

      const result = await service.bulkUpdate(
        tenantId,
        projectId,
        { ids: ['a'], addTagCodes: ['z'], removeTagCodes: ['x'] },
        actor,
      );

      // x を除き z を足した {y, z} で置換され、1 件更新される
      expect(result).toEqual({ updated: 1 });
    });
  });
});
