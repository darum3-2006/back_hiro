import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAccessService } from '../projects/project-access.service';
import type { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import type { TaskResponse } from '../tasks/tasks.service';
import { TasksService } from '../tasks/tasks.service';
import { PublicTaskLookupController } from './public-task-lookup.controller';

describe('PublicTaskLookupController', () => {
  let controller: PublicTaskLookupController;
  let tasks: jest.Mocked<
    Pick<TasksService, 'resolveByCode' | 'findInProject' | 'searchWithDetails'>
  >;
  let projects: jest.Mocked<Pick<ProjectsService, 'findByIdInTenant'>>;
  let access: jest.Mocked<Pick<ProjectAccessService, 'assertAccess' | 'accessibleProjectIds'>>;

  const user: AuthenticatedUser = { userId: 'u1', tenantId: 't1', role: 'power_user' };
  const project = { id: 'p1', key: 'DEMO', archivedAt: null } as Project;
  const taskResponse = {
    id: 'task-1',
    seq: 5,
    shortCode: 'abc123',
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
    tasks = {
      resolveByCode: jest.fn().mockResolvedValue({ projectId: 'p1', id: 'task-1' }),
      findInProject: jest.fn().mockResolvedValue(taskResponse),
      searchWithDetails: jest.fn().mockResolvedValue([{ ...taskResponse, projectKey: 'DEMO' }]),
    };
    projects = { findByIdInTenant: jest.fn().mockResolvedValue(project) };
    access = {
      assertAccess: jest.fn().mockResolvedValue(undefined),
      accessibleProjectIds: jest.fn().mockResolvedValue(['p1']),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicTaskLookupController],
      providers: [
        { provide: TasksService, useValue: tasks },
        { provide: ProjectsService, useValue: projects },
        { provide: ProjectAccessService, useValue: access },
        // ApiKeyGuard の依存（ガード自体はユニットテストでは発動しない）
        { provide: UsersService, useValue: {} },
      ],
    }).compile();

    controller = module.get(PublicTaskLookupController);
  });

  it('短縮コードでタスクを引き、projectKey を付けて返す', async () => {
    const result = await controller.byShortCode(user, 'abc123');

    expect(tasks.resolveByCode).toHaveBeenCalledWith('t1', 'abc123');
    expect(tasks.findInProject).toHaveBeenCalledWith('t1', 'p1', 'task-1');
    expect(result).toMatchObject({ seq: 5, shortCode: 'abc123', projectKey: 'DEMO' });
    // 内部 UUID は露出しない
    expect(result).not.toHaveProperty('id');
    expect(result).not.toHaveProperty('projectId');
  });

  it('閲覧権のないプロジェクトのタスクは 404（存在を伏せる）', async () => {
    access.assertAccess.mockRejectedValue(new NotFoundException());

    await expect(controller.byShortCode(user, 'abc123')).rejects.toThrow(NotFoundException);
    expect(tasks.findInProject).not.toHaveBeenCalled();
  });

  it('他テナント・存在しないコードは resolveByCode の 404 をそのまま返す', async () => {
    tasks.resolveByCode.mockRejectedValue(new NotFoundException('タスクが見つかりません'));

    await expect(controller.byShortCode(user, 'ghost')).rejects.toThrow(NotFoundException);
    expect(access.assertAccess).not.toHaveBeenCalled();
  });

  describe('search', () => {
    it('閲覧できるプロジェクトに絞って検索し、公開形 + projectKey で返す', async () => {
      const result = await controller.search(user, { q: 'タスク', limit: 5 });

      expect(access.accessibleProjectIds).toHaveBeenCalledWith(user);
      expect(tasks.searchWithDetails).toHaveBeenCalledWith('t1', 'タスク', 5, ['p1']);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ seq: 5, shortCode: 'abc123', projectKey: 'DEMO' });
      // 内部 UUID や内部向け項目は露出しない
      expect(result[0]).not.toHaveProperty('id');
      expect(result[0]).not.toHaveProperty('projectId');
      expect(result[0]).not.toHaveProperty('commentCount');
    });

    it('q / limit 未指定は空文字・20 件で検索する', async () => {
      await controller.search(user, {});

      expect(tasks.searchWithDetails).toHaveBeenCalledWith('t1', '', 20, ['p1']);
    });
  });
});
