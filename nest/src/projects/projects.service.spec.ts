import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ProjectMember } from '../members/member.entity';
import { Project } from './project.entity';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  let service: ProjectsService;
  let repo: jest.Mocked<Repository<Project>>;

  const tenantId = 'tenant-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectsService,
        {
          provide: getRepositoryToken(Project),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn((dto: Partial<Project>) => dto as Project),
            save: jest.fn((entity: Project) => Promise.resolve(entity)),
          },
        },
        {
          provide: getRepositoryToken(ProjectMember),
          useValue: { findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(ProjectsService);
    repo = module.get(getRepositoryToken(Project));
  });

  describe('listByTenant', () => {
    it('テナントの project 一覧を createdAt 昇順で返す', async () => {
      const items = [{ id: 'p1', tenantId }] as Project[];
      repo.find.mockResolvedValue(items);

      const result = await service.listByTenant(tenantId);

      expect(result).toBe(items);
      expect(repo.find).toHaveBeenCalledWith({
        where: { tenantId },
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('findByIdInTenant', () => {
    it('該当テナントに存在しなければ NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findByIdInTenant(tenantId, 'p1')).rejects.toThrow(NotFoundException);
    });

    it('別テナントの project は見えない（同じく NotFoundException）', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findByIdInTenant(tenantId, 'p1')).rejects.toThrow(NotFoundException);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { tenantId, id: 'p1' } });
    });
  });

  describe('create', () => {
    it('key を大文字化して保存', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.create(tenantId, { key: 'demo', name: 'Demo' });

      expect(result.key).toBe('DEMO');
      expect(result.tenantId).toBe(tenantId);
    });

    it('説明は trim、空なら null', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.create(tenantId, {
        key: 'a',
        name: 'A',
        description: '   ',
      });

      expect(result.description).toBeNull();
    });

    it('key 重複時は ConflictException', async () => {
      repo.findOne.mockResolvedValue({ id: 'existing' } as Project);

      await expect(service.create(tenantId, { key: 'demo', name: 'Demo' })).rejects.toThrow(
        ConflictException,
      );
    });

    it('key 重複チェックは大文字化後の値で行う', async () => {
      repo.findOne.mockResolvedValue(null);

      await service.create(tenantId, { key: 'demo', name: 'Demo' });

      expect(repo.findOne).toHaveBeenCalledWith({ where: { tenantId, key: 'DEMO' } });
    });
  });

  describe('update', () => {
    const existing: Project = {
      id: 'p1',
      tenantId,
      key: 'DEMO',
      name: 'Old',
      description: null,
      archivedAt: null,
      highlightOverdueDeadline: false,
      highlightOverduePlannedStart: false,
      highlightOverduePlannedCompletion: false,
      highlightOverduePlannedRelease: false,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
      deletedAt: null,
    } as Project;

    it('name のみ更新', async () => {
      repo.findOne.mockResolvedValue({ ...existing } as Project);

      const result = await service.update(tenantId, 'p1', { name: 'New' });

      expect(result.name).toBe('New');
    });

    it('archived: true で archivedAt が現在日時に設定される', async () => {
      repo.findOne.mockResolvedValue({ ...existing } as Project);

      const result = await service.update(tenantId, 'p1', { archived: true });

      expect(result.archivedAt).toBeInstanceOf(Date);
    });

    it('archived: false で archivedAt が null に戻る', async () => {
      repo.findOne.mockResolvedValue({ ...existing, archivedAt: new Date() } as Project);

      const result = await service.update(tenantId, 'p1', { archived: false });

      expect(result.archivedAt).toBeNull();
    });

    it('description: null で説明が消える', async () => {
      repo.findOne.mockResolvedValue({ ...existing, description: 'previous' } as Project);

      const result = await service.update(tenantId, 'p1', { description: null });

      expect(result.description).toBeNull();
    });

    it('存在しない id だと NotFoundException', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update(tenantId, 'unknown', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('highlight フラグを個別に切り替えられる', async () => {
      repo.findOne.mockResolvedValue({ ...existing } as Project);

      const result = await service.update(tenantId, 'p1', {
        highlightOverdueDeadline: true,
        highlightOverduePlannedRelease: true,
      });

      expect(result.highlightOverdueDeadline).toBe(true);
      expect(result.highlightOverduePlannedCompletion).toBe(false);
      expect(result.highlightOverduePlannedRelease).toBe(true);
    });
  });
});
