import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ProjectMember } from '../members/member.entity';
import { NotificationsService } from '../notifications/notifications.service';
import type { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { Task } from '../tasks/task.entity';
import { User } from '../users/user.entity';
import { Comment } from './comment.entity';
import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  let service: CommentsService;
  let comments: jest.Mocked<Repository<Comment>>;
  let tasks: jest.Mocked<Repository<Task>>;
  let members: jest.Mocked<Repository<ProjectMember>>;
  let projects: jest.Mocked<Pick<ProjectsService, 'findByIdInTenant'>>;

  const tenantId = 'tenant-1';
  const projectId = 'project-1';
  const taskId = 'task-1';
  const memberId = 'member-1';

  const baseComment: Comment = {
    id: 'c1',
    projectId,
    taskId,
    authorMemberId: memberId,
    body: 'old',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    deletedAt: null,
  } as Comment;

  beforeEach(async () => {
    projects = {
      findByIdInTenant: jest.fn().mockResolvedValue({ id: projectId } as Project),
    };

    const countQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        {
          provide: getRepositoryToken(Comment),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn((dto: Partial<Comment>) => dto as Comment),
            save: jest.fn((entity: Comment) => Promise.resolve(entity)),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(() => countQb),
          },
        },
        {
          provide: getRepositoryToken(Task),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(ProjectMember),
          useValue: { findOne: jest.fn(), find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(User),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        { provide: ProjectsService, useValue: projects },
        { provide: NotificationsService, useValue: { onCommentMentioned: jest.fn() } },
      ],
    }).compile();

    service = module.get(CommentsService);
    comments = module.get(getRepositoryToken(Comment));
    tasks = module.get(getRepositoryToken(Task));
    members = module.get(getRepositoryToken(ProjectMember));
  });

  describe('listByTask', () => {
    it('プロジェクト/タスクの存在を確認してから一覧を返す', async () => {
      tasks.findOne.mockResolvedValue({ id: taskId } as Task);
      const items = [baseComment];
      comments.find.mockResolvedValue(items);

      const result = await service.listByTask(tenantId, projectId, taskId);

      expect(result).toBe(items);
      expect(projects.findByIdInTenant).toHaveBeenCalledWith(tenantId, projectId);
      expect(tasks.findOne).toHaveBeenCalledWith({ where: { projectId, id: taskId } });
    });

    it('別プロジェクトのタスクは見えない (NotFound)', async () => {
      tasks.findOne.mockResolvedValue(null);

      await expect(service.listByTask(tenantId, projectId, taskId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    beforeEach(() => {
      tasks.findOne.mockResolvedValue({ id: taskId } as Task);
    });

    it('memberId が当該プロジェクトに属していれば保存', async () => {
      members.findOne.mockResolvedValue({ id: memberId, projectId } as ProjectMember);

      const result = await service.create(
        tenantId,
        projectId,
        taskId,
        { authorMemberId: memberId, body: 'hello' },
        'actor-1',
      );

      expect(result.authorMemberId).toBe(memberId);
      expect(result.body).toBe('hello');
    });

    it('memberId が別プロジェクトなら BadRequest', async () => {
      members.findOne.mockResolvedValue(null);

      await expect(
        service.create(
          tenantId,
          projectId,
          taskId,
          { authorMemberId: memberId, body: 'x' },
          'actor-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    beforeEach(() => {
      tasks.findOne.mockResolvedValue({ id: taskId } as Task);
    });

    it('body 更新が反映される', async () => {
      comments.findOne.mockResolvedValue({ ...baseComment });

      const result = await service.update(tenantId, projectId, taskId, 'c1', { body: 'new' });

      expect(result.body).toBe('new');
    });

    it('存在しない id は NotFound', async () => {
      comments.findOne.mockResolvedValue(null);

      await expect(
        service.update(tenantId, projectId, taskId, 'unknown', { body: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    beforeEach(() => {
      tasks.findOne.mockResolvedValue({ id: taskId } as Task);
    });

    it('対象を削除', async () => {
      const target = { ...baseComment };
      comments.findOne.mockResolvedValue(target);

      await service.remove(tenantId, projectId, taskId, 'c1');

      expect(comments.remove).toHaveBeenCalledWith(target);
    });

    it('存在しない id は NotFound', async () => {
      comments.findOne.mockResolvedValue(null);

      await expect(service.remove(tenantId, projectId, taskId, 'unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
