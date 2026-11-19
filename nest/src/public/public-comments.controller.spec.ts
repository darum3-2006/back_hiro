import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import type { Comment } from '../comments/comment.entity';
import { CommentsService } from '../comments/comments.service';
import type { ProjectMember } from '../members/member.entity';
import { MembersService } from '../members/members.service';
import { ProjectAccessService } from '../projects/project-access.service';
import type { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import type { TaskResponse } from '../tasks/tasks.service';
import { TasksService } from '../tasks/tasks.service';
import { UsersService } from '../users/users.service';
import { PublicCommentsController } from './public-comments.controller';

describe('PublicCommentsController', () => {
  let controller: PublicCommentsController;
  let projects: jest.Mocked<Pick<ProjectsService, 'findByKeyInTenant'>>;
  let tasks: jest.Mocked<Pick<TasksService, 'findBySeqInProject'>>;
  let members: jest.Mocked<Pick<MembersService, 'findOwnInProject'>>;
  let comments: jest.Mocked<Pick<CommentsService, 'create' | 'listByTask'>>;

  const user: AuthenticatedUser = { userId: 'u1', tenantId: 't1', role: 'power_user' };
  const project = { id: 'p1', key: 'DEMO', archivedAt: null } as Project;
  const task = { id: 'task-1', seq: 5 } as TaskResponse;
  const createdAt = new Date('2026-11-19T00:00:00Z');
  const comment = {
    id: 'c1',
    projectId: 'p1',
    taskId: 'task-1',
    authorMemberId: 'm1',
    body: 'コメント',
    createdAt,
    updatedAt: createdAt,
  } as Comment;

  beforeEach(async () => {
    projects = { findByKeyInTenant: jest.fn().mockResolvedValue(project) };
    tasks = { findBySeqInProject: jest.fn().mockResolvedValue(task) };
    members = {
      findOwnInProject: jest.fn().mockResolvedValue({ id: 'm1', userId: 'u1' } as ProjectMember),
    };
    comments = {
      create: jest.fn().mockResolvedValue(comment),
      listByTask: jest.fn().mockResolvedValue([comment]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PublicCommentsController],
      providers: [
        { provide: ProjectsService, useValue: projects },
        { provide: TasksService, useValue: tasks },
        { provide: MembersService, useValue: members },
        { provide: CommentsService, useValue: comments },
        // ApiKeyGuard / ProjectAccessGuard の依存（ガード自体はユニットテストでは発動しない）
        { provide: UsersService, useValue: {} },
        { provide: ProjectAccessService, useValue: {} },
      ],
    }).compile();

    controller = module.get(PublicCommentsController);
  });

  describe('list', () => {
    it('seq で解決したタスクのコメントを公開表現で返す', async () => {
      const result = await controller.list(user, 'demo', 5);

      expect(tasks.findBySeqInProject).toHaveBeenCalledWith('t1', 'p1', 5);
      expect(comments.listByTask).toHaveBeenCalledWith('t1', 'p1', 'task-1');
      expect(result).toEqual([
        { id: 'c1', body: 'コメント', authorMemberId: 'm1', createdAt, updatedAt: createdAt },
      ]);
    });

    it('存在しないタスクは 404', async () => {
      tasks.findBySeqInProject.mockRejectedValue(new NotFoundException());

      await expect(controller.list(user, 'demo', 999)).rejects.toThrow(NotFoundException);
      expect(comments.listByTask).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('API キーの持ち主のメンバーを投稿者にして、seq で解決したタスクへ投稿する', async () => {
      const result = await controller.create(user, 'demo', 5, { body: 'コメント' });

      expect(projects.findByKeyInTenant).toHaveBeenCalledWith('t1', 'demo');
      expect(tasks.findBySeqInProject).toHaveBeenCalledWith('t1', 'p1', 5);
      expect(members.findOwnInProject).toHaveBeenCalledWith('p1', 'u1');
      expect(comments.create).toHaveBeenCalledWith(
        't1',
        'p1',
        'task-1',
        { authorMemberId: 'm1', body: 'コメント' },
        'u1',
      );
      // 公開表現にはプロジェクト・タスクの内部 UUID を含めない
      expect(result).toEqual({
        id: 'c1',
        body: 'コメント',
        authorMemberId: 'm1',
        createdAt,
        updatedAt: createdAt,
      });
    });

    it('API キーの持ち主がプロジェクトのメンバーでなければ 403 で、投稿しない', async () => {
      members.findOwnInProject.mockResolvedValue(null);

      await expect(controller.create(user, 'demo', 5, { body: 'x' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(comments.create).not.toHaveBeenCalled();
    });

    it('存在しないタスクは 404 で、投稿しない', async () => {
      tasks.findBySeqInProject.mockRejectedValue(new NotFoundException());

      await expect(controller.create(user, 'demo', 999, { body: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      expect(comments.create).not.toHaveBeenCalled();
    });
  });
});
