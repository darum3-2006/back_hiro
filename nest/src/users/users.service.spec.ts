import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<Repository<User>>;

  const tenantId = 'tenant-1';

  const adminUser: User = {
    id: 'admin-1',
    tenantId,
    email: 'admin@acme.test',
    passwordHash: 'hash',
    name: 'Admin',
    role: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  } as User;

  const memberUser: User = {
    ...adminUser,
    id: 'member-1',
    email: 'member@acme.test',
    name: 'Member',
    role: 'member',
  } as User;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            create: jest.fn((dto: Partial<User>) => dto as User),
            save: jest.fn((entity: User) => Promise.resolve(entity)),
            remove: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    repo = module.get(getRepositoryToken(User));
  });

  describe('create', () => {
    it('email を小文字化して保存', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.create(tenantId, {
        email: 'NEW@acme.test',
        name: 'New User',
        password: 'pass1234',
        role: 'member',
      });

      expect(result.email).toBe('new@acme.test');
      expect(result.role).toBe('member');
      expect(result.passwordHash).not.toBe('pass1234'); // bcrypt されている
    });

    it('email 重複は ConflictException', async () => {
      repo.findOne.mockResolvedValue(adminUser);

      await expect(
        service.create(tenantId, {
          email: 'admin@acme.test',
          name: 'x',
          password: 'pass1234',
          role: 'member',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('name 更新', async () => {
      repo.findOne.mockResolvedValue({ ...adminUser });

      const result = await service.update(tenantId, 'someone', adminUser.id, {
        name: 'New Admin',
      });

      expect(result.name).toBe('New Admin');
    });

    it('自己降格は BadRequest', async () => {
      repo.findOne.mockResolvedValue({ ...adminUser });

      await expect(
        service.update(tenantId, adminUser.id, adminUser.id, { role: 'member' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('最後の admin 降格は BadRequest', async () => {
      repo.findOne.mockResolvedValue({ ...adminUser });
      repo.count.mockResolvedValue(1);

      await expect(
        service.update(tenantId, 'someone', adminUser.id, { role: 'member' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('admin が 2 人以上いれば降格できる', async () => {
      repo.findOne.mockResolvedValue({ ...adminUser });
      repo.count.mockResolvedValue(2);

      const result = await service.update(tenantId, 'someone', adminUser.id, { role: 'member' });

      expect(result.role).toBe('member');
    });

    it('存在しない id は NotFound', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.update(tenantId, 'someone', 'unknown', { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('自己削除は BadRequest', async () => {
      repo.findOne.mockResolvedValue({ ...adminUser });

      await expect(service.remove(tenantId, adminUser.id, adminUser.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('最後の admin 削除は BadRequest', async () => {
      repo.findOne.mockResolvedValue({ ...adminUser });
      repo.count.mockResolvedValue(1);

      await expect(service.remove(tenantId, 'someone', adminUser.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('member は普通に削除', async () => {
      repo.findOne.mockResolvedValue({ ...memberUser });

      await service.remove(tenantId, 'someone', memberUser.id);

      expect(repo.remove).toHaveBeenCalled();
    });
  });
});
