import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { ProjectAccessService } from '../projects/project-access.service';
import { User } from './user.entity';
import { UserSyncService } from './user-sync.service';

describe('UserSyncService', () => {
  let service: UserSyncService;
  let repo: jest.Mocked<Repository<User>>;
  let access: { assertProjectsInTenant: jest.Mock; replaceForUser: jest.Mock };

  const tenantId = 'tenant-1';

  const adminUser: User = {
    id: 'admin-1',
    tenantId,
    email: 'admin@acme.test',
    passwordHash: 'hash',
    name: 'Admin',
    role: 'admin',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date(),
    deletedAt: null,
  } as User;

  const memberUser: User = {
    ...adminUser,
    id: 'member-1',
    email: 'member@acme.test',
    name: 'Member',
    role: 'member',
    createdAt: new Date('2026-01-02'),
  } as User;

  const deletedUser: User = {
    ...adminUser,
    id: 'deleted-1',
    email: 'deleted@acme.test',
    name: 'Deleted',
    role: 'member',
    createdAt: new Date('2026-01-03'),
    deletedAt: new Date('2026-06-01'),
  } as User;

  beforeEach(async () => {
    access = {
      assertProjectsInTenant: jest.fn().mockResolvedValue(undefined),
      replaceForUser: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSyncService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            count: jest.fn(),
            create: jest.fn((dto: Partial<User>) => dto as User),
            save: jest.fn((entity: User) => Promise.resolve({ ...entity, id: 'new-1' })),
            softRemove: jest.fn(),
            restore: jest.fn(),
          },
        },
        { provide: ProjectAccessService, useValue: access },
      ],
    }).compile();

    service = module.get(UserSyncService);
    repo = module.get(getRepositoryToken(User));
  });

  describe('preview', () => {
    it('新規・復活・変更なし・削除に分類する', async () => {
      repo.find.mockResolvedValue([adminUser, memberUser, deletedUser]);

      const { items } = await service.preview(tenantId, adminUser.id, {
        rows: [
          { email: 'admin@acme.test', name: 'Admin' },
          { email: 'new@acme.test', name: '新規 太郎' },
          { email: 'deleted@acme.test', name: 'Deleted' },
        ],
        defaultRole: 'member',
      });

      const byEmail = new Map(items.map((it) => [it.email, it]));
      expect(byEmail.get('admin@acme.test')?.type).toBe('unchanged');
      expect(byEmail.get('new@acme.test')?.type).toBe('create');
      expect(byEmail.get('deleted@acme.test')?.type).toBe('restore');
      expect(byEmail.get('member@acme.test')?.type).toBe('delete');
      expect(byEmail.get('member@acme.test')?.protectedReason).toBeUndefined();
    });

    it('メールは trim + 小文字化して突き合わせる', async () => {
      repo.find.mockResolvedValue([adminUser]);

      const { items } = await service.preview(tenantId, adminUser.id, {
        rows: [{ email: '  ADMIN@Acme.test ', name: 'Admin' }],
        defaultRole: 'member',
      });

      expect(items).toHaveLength(1);
      expect(items[0].type).toBe('unchanged');
    });

    it('ロール列の有効値はデフォルトより優先、無効値はデフォルト + 警告', async () => {
      repo.find.mockResolvedValue([]);

      const { items } = await service.preview(tenantId, 'someone', {
        rows: [
          { email: 'a@acme.test', name: 'A', role: ' Power_User ' },
          { email: 'b@acme.test', name: 'B', role: 'menber' },
          { email: 'c@acme.test', name: 'C' },
        ],
        defaultRole: 'readonly',
      });

      expect(items[0].role).toBe('power_user');
      expect(items[0].warnings).toHaveLength(0);
      expect(items[1].role).toBe('readonly');
      expect(items[1].warnings[0]).toContain('無効なロール値');
      expect(items[2].role).toBe('readonly');
    });

    it('氏名空欄・メール不正・ファイル内重複はエラー行になる', async () => {
      repo.find.mockResolvedValue([]);

      const { items } = await service.preview(tenantId, 'someone', {
        rows: [
          { email: 'a@acme.test', name: '' },
          { email: 'not-an-email', name: 'B' },
          { email: 'c@acme.test', name: 'C1' },
          { email: 'c@acme.test', name: 'C2' },
        ],
        defaultRole: 'member',
      });

      expect(items[0].type).toBe('error');
      expect(items[0].warnings[0]).toContain('氏名');
      expect(items[1].type).toBe('error');
      expect(items[1].warnings[0]).toContain('メールアドレス');
      expect(items[2].type).toBe('create');
      expect(items[3].type).toBe('error');
      expect(items[3].warnings[0]).toContain('重複');
    });

    it('エラー行のメールに一致する既存ユーザーは削除対象にしない', async () => {
      repo.find.mockResolvedValue([adminUser, memberUser]);

      const { items } = await service.preview(tenantId, adminUser.id, {
        // member の行は氏名空欄で壊れているが、在籍扱いにして削除しない
        rows: [
          { email: 'admin@acme.test', name: 'Admin' },
          { email: 'member@acme.test', name: '' },
        ],
        defaultRole: 'member',
      });

      expect(items.filter((it) => it.type === 'delete')).toHaveLength(0);
      expect(items.find((it) => it.email === 'member@acme.test')?.type).toBe('error');
    });

    it('実行者自身はファイルに無くても保護される', async () => {
      repo.find.mockResolvedValue([adminUser, memberUser]);

      const { items } = await service.preview(tenantId, memberUser.id, {
        rows: [{ email: 'admin@acme.test', name: 'Admin' }],
        defaultRole: 'member',
      });

      const self = items.find((it) => it.email === 'member@acme.test');
      expect(self?.type).toBe('delete');
      expect(self?.protectedReason).toContain('実行者自身');
    });

    it('管理者が 0 人になる削除は 1 人だけ保護される', async () => {
      const admin2: User = {
        ...adminUser,
        id: 'admin-2',
        email: 'admin2@acme.test',
        createdAt: new Date('2026-01-05'),
      } as User;
      repo.find.mockResolvedValue([adminUser, admin2, memberUser]);

      const { items } = await service.preview(tenantId, memberUser.id, {
        rows: [{ email: 'member@acme.test', name: 'Member' }],
        defaultRole: 'member',
      });

      const deletes = items.filter((it) => it.type === 'delete');
      // 作成日の古い admin-1 が保護され、admin-2 は削除できる
      expect(deletes.find((it) => it.userId === 'admin-1')?.protectedReason).toContain('管理者');
      expect(deletes.find((it) => it.userId === 'admin-2')?.protectedReason).toBeUndefined();
    });

    it('復活予定の admin がいれば既存 admin の削除は保護されない', async () => {
      const deletedAdmin: User = {
        ...deletedUser,
        id: 'deleted-admin',
        email: 'old-admin@acme.test',
        role: 'admin',
      } as User;
      repo.find.mockResolvedValue([adminUser, memberUser, deletedAdmin]);

      const { items } = await service.preview(tenantId, memberUser.id, {
        rows: [
          { email: 'member@acme.test', name: 'Member' },
          { email: 'old-admin@acme.test', name: 'Old Admin' },
        ],
        defaultRole: 'member',
      });

      const adminDelete = items.find((it) => it.userId === adminUser.id);
      expect(adminDelete?.type).toBe('delete');
      expect(adminDelete?.protectedReason).toBeUndefined();
    });

    it('変更なしでも氏名・ロールの差分は警告として出す', async () => {
      repo.find.mockResolvedValue([memberUser]);

      const { items } = await service.preview(tenantId, memberUser.id, {
        rows: [{ email: 'member@acme.test', name: '改名 後', role: 'admin' }],
        defaultRole: 'member',
      });

      expect(items[0].type).toBe('unchanged');
      expect(items[0].warnings.some((w) => w.includes('氏名'))).toBe(true);
      expect(items[0].warnings.some((w) => w.includes('ロール'))).toBe(true);
    });
  });

  describe('execute', () => {
    it('create はランダムパスワードで作成し、プロジェクトを付与する', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.execute(tenantId, 'admin-1', {
        actions: [
          {
            type: 'create',
            email: 'new@acme.test',
            name: '新規',
            role: 'member',
            projectIds: ['p-1'],
          },
        ],
      });

      expect(result.applied.create).toBe(1);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@acme.test', role: 'member' }),
      );
      const saved = repo.save.mock.calls[0][0] as User;
      expect(saved.passwordHash).toMatch(/^\$2[aby]\$/); // bcrypt ハッシュ
      expect(access.replaceForUser).toHaveBeenCalledWith(tenantId, 'new-1', ['p-1']);
    });

    it('create は既存メール（削除済み含む）ならスキップ', async () => {
      repo.findOne.mockResolvedValue(deletedUser);

      const result = await service.execute(tenantId, 'admin-1', {
        actions: [{ type: 'create', email: 'deleted@acme.test', name: 'X', role: 'member' }],
      });

      expect(result.applied.create).toBe(0);
      expect(result.items[0].status).toBe('skipped');
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('restore は削除済みユーザーの deleted_at を戻すだけ', async () => {
      repo.findOne.mockResolvedValue(deletedUser);

      const result = await service.execute(tenantId, 'admin-1', {
        actions: [{ type: 'restore', userId: deletedUser.id }],
      });

      expect(result.applied.restore).toBe(1);
      expect(repo.restore).toHaveBeenCalledWith(deletedUser.id);
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('restore はすでに有効ならスキップ', async () => {
      repo.findOne.mockResolvedValue(memberUser);

      const result = await service.execute(tenantId, 'admin-1', {
        actions: [{ type: 'restore', userId: memberUser.id }],
      });

      expect(result.items[0].status).toBe('skipped');
      expect(repo.restore).not.toHaveBeenCalled();
    });

    it('delete は softRemove、実行者自身と最後の admin はスキップ', async () => {
      repo.findOne.mockImplementation(({ where }: { where: { id: string } }) => {
        const found = [adminUser, memberUser].find((u) => u.id === where.id) ?? null;
        return Promise.resolve(found ? { ...found } : null);
      });
      repo.count.mockResolvedValue(1); // 有効な admin は 1 人

      const result = await service.execute(tenantId, memberUser.id, {
        actions: [
          { type: 'delete', userId: memberUser.id },
          { type: 'delete', userId: adminUser.id },
          { type: 'delete', userId: 'missing' },
        ],
      });

      expect(result.applied.delete).toBe(0);
      expect(result.skipped).toBe(3);
      expect(result.items[0].reason).toContain('実行者自身');
      expect(result.items[1].reason).toContain('最後の管理者');
      expect(result.items[2].reason).toContain('見つかりません');
      expect(repo.softRemove).not.toHaveBeenCalled();
    });

    it('復活 → 追加 → 削除の順で適用する', async () => {
      const calls: string[] = [];
      repo.findOne.mockImplementation((options: { withDeleted?: boolean }) => {
        if (options.withDeleted) {
          calls.push('restore-or-create');
          return Promise.resolve({ ...deletedUser });
        }
        calls.push('delete');
        return Promise.resolve({ ...memberUser });
      });

      await service.execute(tenantId, 'admin-1', {
        actions: [
          { type: 'delete', userId: memberUser.id },
          { type: 'restore', userId: deletedUser.id },
        ],
      });

      expect(calls).toEqual(['restore-or-create', 'delete']);
    });
  });
});
