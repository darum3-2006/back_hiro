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
    isActive: true,
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
            softRemove: jest.fn(),
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

    it('重複チェックは削除済みユーザーも対象（withDeleted）', async () => {
      repo.findOne.mockResolvedValue({ ...adminUser, deletedAt: new Date() });

      await expect(
        service.create(tenantId, {
          email: 'admin@acme.test',
          name: 'x',
          password: 'pass1234',
          role: 'member',
        }),
      ).rejects.toThrow('このメールアドレスは削除済みユーザーが使用しています');
      expect(repo.findOne).toHaveBeenCalledWith(expect.objectContaining({ withDeleted: true }));
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

      await expect(service.update(tenantId, 'someone', 'unknown', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('自己無効化は BadRequest', async () => {
      repo.findOne.mockResolvedValue({ ...adminUser });

      await expect(
        service.update(tenantId, adminUser.id, adminUser.id, { isActive: false }),
      ).rejects.toThrow(BadRequestException);
    });

    it('最後の有効な admin の無効化は BadRequest', async () => {
      repo.findOne.mockResolvedValue({ ...adminUser });
      repo.count.mockResolvedValue(1);

      await expect(
        service.update(tenantId, 'someone', adminUser.id, { isActive: false }),
      ).rejects.toThrow(BadRequestException);
    });

    it('有効な admin が 2 人以上いれば無効化できる', async () => {
      repo.findOne.mockResolvedValue({ ...adminUser });
      repo.count.mockResolvedValue(2);

      const result = await service.update(tenantId, 'someone', adminUser.id, { isActive: false });

      expect(result.isActive).toBe(false);
      expect(repo.count).toHaveBeenCalledWith({
        where: { tenantId, role: 'admin', isActive: true },
      });
    });

    it('member の無効化と再有効化ができる', async () => {
      repo.findOne.mockResolvedValue({ ...memberUser });
      const disabled = await service.update(tenantId, 'someone', memberUser.id, {
        isActive: false,
      });
      expect(disabled.isActive).toBe(false);

      repo.findOne.mockResolvedValue({ ...memberUser, isActive: false });
      const enabled = await service.update(tenantId, 'someone', memberUser.id, { isActive: true });
      expect(enabled.isActive).toBe(true);
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

    it('member は論理削除される（softRemove）', async () => {
      repo.findOne.mockResolvedValue({ ...memberUser });

      await service.remove(tenantId, 'someone', memberUser.id);

      expect(repo.softRemove).toHaveBeenCalled();
    });

    it('無効化済み admin は有効な admin が 1 人でも削除できる', async () => {
      repo.findOne.mockResolvedValue({ ...adminUser, isActive: false });
      // 有効な admin が 1 人しかいない状況。無効な admin ならこの制限に掛からない
      repo.count.mockResolvedValue(1);

      await service.remove(tenantId, 'someone', adminUser.id);

      // User は BaseEntity の deleted_at を持つので削除は論理削除
      expect(repo.softRemove).toHaveBeenCalled();
    });
  });

  describe('画面設定', () => {
    it('未設定なら既定値が入って返る', async () => {
      repo.findOne.mockResolvedValue({ ...memberUser, settings: null });

      const got = await service.getSettings(tenantId, memberUser.id);

      expect(got.dashboard).toEqual({ dateField: 'deadline', dueSoonDays: 7, inactiveDays: 7 });
    });

    it('一部だけ保存済みなら、欠けた項目に既定値が当たる', async () => {
      repo.findOne.mockResolvedValue({
        ...memberUser,
        settings: { dashboard: { dueSoonDays: 3 } },
      } as User);

      const got = await service.getSettings(tenantId, memberUser.id);

      expect(got.dashboard).toEqual({ dateField: 'deadline', dueSoonDays: 3, inactiveDays: 7 });
    });

    it('更新は指定した項目だけ差し替え、同じ画面の他項目は残す', async () => {
      const user = {
        ...memberUser,
        settings: { dashboard: { dateField: 'plannedRelease', dueSoonDays: 3 } },
      } as User;
      repo.findOne.mockResolvedValue(user);

      await service.updateSettings(tenantId, memberUser.id, { dashboard: { dueSoonDays: 14 } });

      expect(user.settings?.dashboard).toEqual({
        dateField: 'plannedRelease',
        dueSoonDays: 14,
        inactiveDays: 7,
      });
    });

    it('他画面の設定を巻き込まない', async () => {
      const user = {
        ...memberUser,
        settings: { other: { foo: 1 }, dashboard: { dueSoonDays: 3 } },
      } as unknown as User;
      repo.findOne.mockResolvedValue(user);

      await service.updateSettings(tenantId, memberUser.id, {
        dashboard: { dateField: 'plannedCompletion' },
      });

      expect((user.settings as Record<string, unknown>).other).toEqual({ foo: 1 });
    });

    it('dashboard を渡さなければ既存設定は変わらない', async () => {
      const user = {
        ...memberUser,
        settings: { dashboard: { dueSoonDays: 3 } },
      } as User;
      repo.findOne.mockResolvedValue(user);

      await service.updateSettings(tenantId, memberUser.id, {});

      expect(user.settings?.dashboard).toEqual({ dueSoonDays: 3 });
    });
  });
});
