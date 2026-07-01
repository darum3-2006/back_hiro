import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { EntityManager, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SlackService } from '../slack/slack.service';
import { TaskStatus } from '../masters/task-status.entity';
import { ProjectMember } from '../members/member.entity';
import type { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { Task } from '../tasks/task.entity';
import { Subtask } from './subtask.entity';
import { SubtasksService } from './subtasks.service';

describe('SubtasksService', () => {
  let service: SubtasksService;
  let subtasksRepo: jest.Mocked<
    Pick<
      Repository<Subtask>,
      'find' | 'findOne' | 'create' | 'save' | 'remove' | 'createQueryBuilder'
    >
  > & { manager: { transaction: jest.Mock } };
  let tasksRepo: jest.Mocked<Pick<Repository<Task>, 'findOne'>>;
  let membersRepo: jest.Mocked<Pick<Repository<ProjectMember>, 'findOne'>>;
  let statusesRepo: jest.Mocked<Pick<Repository<TaskStatus>, 'findOne'>>;
  let auditRecord: jest.Mock;
  let slack: { notifySubtaskAdded: jest.Mock; notifySubtaskCompleted: jest.Mock };
  let notifications: { onSubtaskAssigned: jest.Mock };

  const tenantId = 'tenant-1';
  const projectId = 'project-1';
  const taskId = 'task-1';

  const actor = 'user-1';
  const parentTask = { id: taskId, projectId, statusCode: 'todo' } as Task;

  beforeEach(async () => {
    const maxPosQb = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ maxPos: 2 }),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubtasksService,
        {
          provide: getRepositoryToken(Subtask),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            create: jest.fn((dto: Partial<Subtask>) => dto as Subtask),
            save: jest.fn((e: Subtask) => Promise.resolve({ ...e, id: e.id ?? 'st1' })),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(() => maxPosQb),
            manager: {
              transaction: jest.fn((cb: (m: EntityManager) => Promise<unknown>) =>
                cb({
                  getRepository: () => ({
                    save: jest.fn((e: Subtask) => Promise.resolve({ ...e, id: e.id ?? 'st1' })),
                    remove: jest.fn(),
                    update: jest.fn(),
                  }),
                } as unknown as EntityManager),
              ),
            },
          },
        },
        { provide: getRepositoryToken(Task), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(ProjectMember), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(TaskStatus), useValue: { findOne: jest.fn() } },
        {
          provide: ProjectsService,
          useValue: { findByIdInTenant: jest.fn().mockResolvedValue({ id: projectId } as Project) },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
        {
          provide: SlackService,
          useValue: { notifySubtaskAdded: jest.fn(), notifySubtaskCompleted: jest.fn() },
        },
        { provide: NotificationsService, useValue: { onSubtaskAssigned: jest.fn() } },
      ],
    }).compile();

    service = module.get(SubtasksService);
    subtasksRepo = module.get(getRepositoryToken(Subtask));
    tasksRepo = module.get(getRepositoryToken(Task));
    membersRepo = module.get(getRepositoryToken(ProjectMember));
    statusesRepo = module.get(getRepositoryToken(TaskStatus));
    auditRecord = (module.get(AuditService) as unknown as { record: jest.Mock }).record;
    slack = module.get(SlackService);
    notifications = module.get(NotificationsService);
  });

  describe('create', () => {
    it('親末尾の次の position で作成する', async () => {
      tasksRepo.findOne.mockResolvedValue(parentTask);
      statusesRepo.findOne.mockResolvedValue({ isTerminal: false } as TaskStatus);

      const result = await service.create(tenantId, projectId, taskId, { title: '  子  ' }, actor);

      expect(result.title).toBe('子');
      expect(result.position).toBe(3); // maxPos 2 + 1
      expect(result.done).toBe(false);
      // 親タスクの監査ログに subtask_added を記録
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          entityType: 'task',
          entityId: taskId,
          action: 'update',
          changes: [expect.objectContaining({ field: 'subtask_added', new: '子' })],
        }),
        expect.anything(),
      );
      // Slack「新しいタスク」トグルに相乗りして追加通知
      expect(slack.notifySubtaskAdded).toHaveBeenCalledWith(tenantId, parentTask, '子');
    });

    it('担当付きで作成すると担当へアプリ内通知する', async () => {
      tasksRepo.findOne.mockResolvedValue(parentTask);
      statusesRepo.findOne.mockResolvedValue({ isTerminal: false } as TaskStatus);
      membersRepo.findOne.mockResolvedValue({ id: 'm1' } as ProjectMember);

      await service.create(
        tenantId,
        projectId,
        taskId,
        { title: '子', assigneeMemberId: 'm1' },
        actor,
      );

      expect(notifications.onSubtaskAssigned).toHaveBeenCalledWith(
        tenantId,
        parentTask,
        '子',
        'm1',
        actor,
      );
    });

    it('親が終端（完了）のときは追加できない', async () => {
      tasksRepo.findOne.mockResolvedValue(parentTask);
      statusesRepo.findOne.mockResolvedValue({ isTerminal: true } as TaskStatus);

      await expect(
        service.create(tenantId, projectId, taskId, { title: '子' }, actor),
      ).rejects.toThrow(BadRequestException);
    });

    it('存在しない担当メンバーは 400', async () => {
      tasksRepo.findOne.mockResolvedValue(parentTask);
      statusesRepo.findOne.mockResolvedValue({ isTerminal: false } as TaskStatus);
      membersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(
          tenantId,
          projectId,
          taskId,
          { title: '子', assigneeMemberId: 'm-x' },
          actor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('親タスクが無ければ 404', async () => {
      tasksRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create(tenantId, projectId, taskId, { title: '子' }, actor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('done=true で completedAt がセットされる', async () => {
      tasksRepo.findOne.mockResolvedValue(parentTask);
      subtasksRepo.findOne.mockResolvedValue({
        id: 'st1',
        taskId,
        done: false,
        completedAt: null,
      } as Subtask);

      const result = await service.update(
        tenantId,
        projectId,
        taskId,
        'st1',
        { done: true },
        actor,
      );

      expect(result.done).toBe(true);
      expect(result.completedAt).toBeInstanceOf(Date);
      expect(auditRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: [expect.objectContaining({ field: 'subtask_completed' })],
        }),
        expect.anything(),
      );
      // Slack「タスク完了」トグルに相乗りして完了通知
      expect(slack.notifySubtaskCompleted).toHaveBeenCalledWith(tenantId, parentTask, undefined);
    });

    it('担当を新しく設定するとアプリ内通知する', async () => {
      tasksRepo.findOne.mockResolvedValue(parentTask);
      membersRepo.findOne.mockResolvedValue({ id: 'm2' } as ProjectMember);
      subtasksRepo.findOne.mockResolvedValue({
        id: 'st1',
        taskId,
        title: '子',
        assigneeMemberId: null,
        done: false,
      } as Subtask);

      await service.update(tenantId, projectId, taskId, 'st1', { assigneeMemberId: 'm2' }, actor);

      expect(notifications.onSubtaskAssigned).toHaveBeenCalledWith(
        tenantId,
        parentTask,
        '子',
        'm2',
        actor,
      );
    });

    it('親が終端のとき、子の完了解除（done=false）は拒否', async () => {
      tasksRepo.findOne.mockResolvedValue({ ...parentTask, statusCode: 'done' } as Task);
      statusesRepo.findOne.mockResolvedValue({ isTerminal: true } as TaskStatus);
      subtasksRepo.findOne.mockResolvedValue({
        id: 'st1',
        taskId,
        done: true,
        completedAt: new Date(),
      } as Subtask);

      await expect(
        service.update(tenantId, projectId, taskId, 'st1', { done: false }, actor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reorder', () => {
    it('指定 id が当該タスクの全件と一致しないと 400', async () => {
      tasksRepo.findOne.mockResolvedValue(parentTask);
      subtasksRepo.find.mockResolvedValue([{ id: 'a' } as Subtask, { id: 'b' } as Subtask]);

      await expect(service.reorder(tenantId, projectId, taskId, { ids: ['a'] })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
