import { NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { Tag } from './tag.entity';
import { TagsService } from './tags.service';

describe('TagsService', () => {
  let service: TagsService;
  let repo: jest.Mocked<Repository<Tag>>;
  let projects: jest.Mocked<Pick<ProjectsService, 'findByIdInTenant'>>;

  const tenantId = 'tenant-1';
  const projectId = 'project-1';

  beforeEach(async () => {
    projects = {
      findByIdInTenant: jest.fn().mockResolvedValue({ id: projectId } as Project),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagsService,
        {
          provide: getRepositoryToken(Tag),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn((dto: Partial<Tag>) => dto as Tag),
            save: jest.fn((entity: Tag) => Promise.resolve(entity)),
            remove: jest.fn(),
          },
        },
        { provide: ProjectsService, useValue: projects },
      ],
    }).compile();

    service = module.get(TagsService);
    repo = module.get(getRepositoryToken(Tag));
  });

  describe('create', () => {
    it('code は t_ プレフィックスでランダム生成', async () => {
      const result = await service.create(tenantId, projectId, {
        name: 'バグ',
        color: 'error',
      });

      expect(result.code).toMatch(/^t_/);
      expect(result.name).toBe('バグ');
      expect(result.color).toBe('error');
    });

    it('name は trim される', async () => {
      const result = await service.create(tenantId, projectId, {
        name: '  バグ  ',
        color: 'error',
      });

      expect(result.name).toBe('バグ');
    });
  });

  describe('update', () => {
    it('name のみ更新', async () => {
      repo.findOne.mockResolvedValue({
        id: 't1',
        projectId,
        code: 'a',
        name: 'old',
        color: 'neutral',
      } as Tag);

      const result = await service.update(tenantId, projectId, 'a', { name: 'new' });

      expect(result.name).toBe('new');
    });

    it('存在しない code は NotFound', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update(tenantId, projectId, 'unknown', { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
