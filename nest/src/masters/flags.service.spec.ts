import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import type { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { TaskFlag } from '../tasks/task-flag.entity';
import { Flag } from './flag.entity';
import { FlagsService } from './flags.service';

describe('FlagsService', () => {
  let service: FlagsService;
  let repo: jest.Mocked<Repository<Flag>>;
  let taskFlags: jest.Mocked<Pick<Repository<TaskFlag>, 'delete' | 'query'>> & {
    manager: { transaction: jest.Mock };
  };
  let projects: jest.Mocked<Pick<ProjectsService, 'findByIdInTenant'>>;
  let emMock: { query: jest.Mock; delete: jest.Mock };

  const tenantId = 'tenant-1';
  const projectId = 'project-1';
  const actor = 'user-1';

  beforeEach(async () => {
    projects = {
      findByIdInTenant: jest.fn().mockResolvedValue({ id: projectId } as Project),
    };
    emMock = { query: jest.fn().mockResolvedValue([]), delete: jest.fn() };
    taskFlags = {
      delete: jest.fn(),
      query: jest.fn(),
      manager: {
        transaction: jest.fn(async (cb: (m: typeof emMock) => Promise<unknown>) => cb(emMock)),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlagsService,
        {
          provide: getRepositoryToken(Flag),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn((dto: Partial<Flag>) => dto as Flag),
            save: jest.fn((entity: Flag) => Promise.resolve(entity)),
            remove: jest.fn(),
          },
        },
        { provide: getRepositoryToken(TaskFlag), useValue: taskFlags },
        { provide: ProjectsService, useValue: projects },
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(FlagsService);
    repo = module.get(getRepositoryToken(Flag));
  });

  describe('create', () => {
    it('code は f_ プレフィックスでランダム生成', async () => {
      const result = await service.create(tenantId, projectId, {
        name: '今スプリント',
        color: 'info',
      });

      expect(result.code).toMatch(/^f_/);
      expect(result.name).toBe('今スプリント');
      expect(result.color).toBe('info');
    });

    it('name は trim される', async () => {
      const result = await service.create(tenantId, projectId, {
        name: '  要確認  ',
        color: 'warning',
      });

      expect(result.name).toBe('要確認');
    });
  });

  describe('update', () => {
    it('name のみ更新', async () => {
      repo.findOne.mockResolvedValue({
        id: 'f1',
        projectId,
        code: 'a',
        name: 'old',
        color: 'neutral',
      } as Flag);

      const result = await service.update(tenantId, projectId, 'a', { name: 'new' });

      expect(result.name).toBe('new');
    });

    it('存在しない code は NotFound', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update(tenantId, projectId, 'unknown', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('detachFromAllTasks', () => {
    it('該当フラグの task_flags を全削除する（定義は残す）', async () => {
      repo.findOne.mockResolvedValue({ id: 'f1', projectId, code: 'a' } as Flag);

      await service.detachFromAllTasks(tenantId, projectId, actor, 'a');

      expect(emMock.delete).toHaveBeenCalledWith(TaskFlag, { flagId: 'f1' });
      expect(repo.remove).not.toHaveBeenCalled();
    });

    it('存在しない code は NotFound', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.detachFromAllTasks(tenantId, projectId, actor, 'unknown'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('copyToFlag', () => {
    it('source が付いた全タスクへ target を追加（INSERT IGNORE、source は残す）', async () => {
      repo.findOne
        .mockResolvedValueOnce({ id: 'src', projectId, code: 'a' } as Flag)
        .mockResolvedValueOnce({ id: 'tgt', projectId, code: 'b' } as Flag);

      await service.copyToFlag(tenantId, projectId, actor, 'a', 'b');

      expect(emMock.query).toHaveBeenCalledWith(expect.stringContaining('INSERT IGNORE'), [
        'tgt',
        'src',
      ]);
    });

    it('コピー元と先が同じなら BadRequest', async () => {
      await expect(service.copyToFlag(tenantId, projectId, actor, 'a', 'a')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('moveToFlag', () => {
    it('target を追加してから source を削除する（同一トランザクション）', async () => {
      repo.findOne
        .mockResolvedValueOnce({ id: 'src', projectId, code: 'a' } as Flag)
        .mockResolvedValueOnce({ id: 'tgt', projectId, code: 'b' } as Flag);

      await service.moveToFlag(tenantId, projectId, actor, 'a', 'b');

      expect(emMock.query).toHaveBeenCalledWith(expect.stringContaining('INSERT IGNORE'), [
        'tgt',
        'src',
      ]);
      expect(emMock.delete).toHaveBeenCalledWith(TaskFlag, { flagId: 'src' });
    });

    it('移動元と先が同じなら BadRequest', async () => {
      await expect(service.moveToFlag(tenantId, projectId, actor, 'a', 'a')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
