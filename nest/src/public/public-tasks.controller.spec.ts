import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import type { TaskStatus } from '../masters/task-status.entity';
import { TaskStatusesService } from '../masters/task-statuses.service';
import type { ProjectMember } from '../members/member.entity';
import { MembersService } from '../members/members.service';
import { ProjectAccessService } from '../projects/project-access.service';
import type { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import type { TaskResponse } from '../tasks/tasks.service';
import { TasksService } from '../tasks/tasks.service';
import { PublicTasksController } from './public-tasks.controller';

describe('PublicTasksController', () => {
  let controller: PublicTasksController;
  let projects: jest.Mocked<Pick<ProjectsService, 'findByKeyInTenant'>>;
  let tasks: jest.Mocked<
    Pick<TasksService, 'listByProject' | 'findBySeqInProject' | 'create' | 'update'>
  >;
  let statuses: jest.Mocked<Pick<TaskStatusesService, 'listByProject'>>;
  let members: jest.Mocked<Pick<MembersService, 'listByProject'>>;

  const user: AuthenticatedUser = { userId: 'u1', tenantId: 't1', role: 'power_user' };
  const project = { id: 'p1', key: 'DEMO', archivedAt: null } as Project;
  const taskResponse = {
    id: 'task-1',
    seq: 5,
    shortCode: 'abc',
    content: 'タスク',
    description: '',
    links: [],
    statusCode: 'todo',
    priorityCode: null,
    assigneeMemberId: null,
    requesterMemberId: null,
    requestingDeptCode: null,
    tagCodes: [],
    flagCodes: [],
    deadline: null,
    plannedStartDate: null,
    plannedCompletionDate: null,
    plannedReleaseDate: null,
    completedAt: null,
    statusChangedAt: new Date(),
    commentCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as unknown as TaskResponse;

  beforeEach(async () => {
    projects = { findByKeyInTenant: jest.fn().mockResolvedValue(project) };
    tasks = {
      listByProject: jest.fn().mockResolvedValue([]),
      findBySeqInProject: jest.fn().mockResolvedValue(taskResponse),
      create: jest.fn().mockResolvedValue(taskResponse),
      update: jest.fn().mockResolvedValue(taskResponse),
    };
    statuses = {
      listByProject: jest.fn().mockResolvedValue([
        { code: 'todo', order: 1 },
        { code: 'done', order: 2 },
      ] as TaskStatus[]),
    };
    members = {
      listByProject: jest.fn().mockResolvedValue([{ id: 'm1' } as ProjectMember]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicTasksController],
      providers: [
        { provide: ProjectsService, useValue: projects },
        { provide: TasksService, useValue: tasks },
        { provide: TaskStatusesService, useValue: statuses },
        { provide: MembersService, useValue: members },
        // ApiKeyGuard / ProjectAccessGuard の依存（ガード自体はユニットテストでは発動しない）
        { provide: UsersService, useValue: {} },
        { provide: ProjectAccessService, useValue: {} },
      ],
    }).compile();

    controller = module.get(PublicTasksController);
  });

  describe('create', () => {
    it('ステータスマスタの先頭（order 最小）を自動セットして作成する', async () => {
      await controller.create(user, 'demo', { content: '新タスク' });

      expect(tasks.create).toHaveBeenCalledWith(
        't1',
        'p1',
        expect.objectContaining({ content: '新タスク', statusCode: 'todo' }),
        'u1',
      );
    });

    it('ステータスマスタが未定義なら 400', async () => {
      statuses.listByProject.mockResolvedValue([]);

      await expect(controller.create(user, 'demo', { content: 'x' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('アーカイブ済みプロジェクトへの作成は 400', async () => {
      projects.findByKeyInTenant.mockResolvedValue({
        ...project,
        archivedAt: new Date(),
      } as Project);

      await expect(controller.create(user, 'demo', { content: 'x' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('プロジェクト外の起票者は 400', async () => {
      await expect(
        controller.create(user, 'demo', {
          content: 'x',
          requesterMemberId: '11111111-1111-4111-8111-111111111111',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('setStatus', () => {
    it('マスタに存在するコードなら update に渡す', async () => {
      await controller.setStatus(user, 'demo', 5, { statusCode: 'done' });

      expect(tasks.update).toHaveBeenCalledWith('t1', 'p1', 'task-1', { statusCode: 'done' }, 'u1');
    });

    it('マスタに存在しないコードは 400', async () => {
      await expect(controller.setStatus(user, 'demo', 5, { statusCode: 'ghost' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('setMember', () => {
    it('プロジェクトのメンバーなら担当に割り当てる', async () => {
      await controller.setMember(user, 'demo', 5, { memberId: 'm1' });

      expect(tasks.update).toHaveBeenCalledWith(
        't1',
        'p1',
        'task-1',
        { assigneeMemberId: 'm1' },
        'u1',
      );
    });

    it('null / 省略で担当なしに戻す', async () => {
      await controller.setMember(user, 'demo', 5, {});

      expect(tasks.update).toHaveBeenCalledWith(
        't1',
        'p1',
        'task-1',
        { assigneeMemberId: null },
        'u1',
      );
    });

    it('プロジェクト外のメンバーは 400', async () => {
      await expect(controller.setMember(user, 'demo', 5, { memberId: 'ghost' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
