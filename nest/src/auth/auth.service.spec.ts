import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { TenantsService } from '../tenants/tenants.service';
import type { Tenant } from '../tenants/tenant.entity';
import { UsersService } from '../users/users.service';
import type { User } from '../users/user.entity';
import { AuthService } from './auth.service';
import { RefreshToken } from './refresh-token.entity';

describe('AuthService', () => {
  let service: AuthService;
  let tenants: jest.Mocked<TenantsService>;
  let users: jest.Mocked<UsersService>;
  let jwt: jest.Mocked<JwtService>;
  let refreshRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  const password = 'admin123';
  let passwordHash: string;
  const dto = {
    tenantKey: 'acme',
    email: 'admin@acme.test',
    password,
  };
  const tenant = { id: 't1', key: 'acme', name: 'Acme' } as Tenant;
  let user: User;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(password, 4); // テスト用に弱いコストで高速化
  });

  beforeEach(async () => {
    user = {
      id: 'u1',
      tenantId: 't1',
      email: dto.email,
      name: 'Admin',
      passwordHash,
    } as User;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: { signAsync: jest.fn() } },
        {
          provide: UsersService,
          useValue: { findByTenantAndEmail: jest.fn(), findById: jest.fn() },
        },
        { provide: TenantsService, useValue: { findByKey: jest.fn(), findById: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('test-google-client-id'),
            get: jest.fn().mockReturnValue(undefined),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn((e: RefreshToken) => Promise.resolve({ ...e, id: e.id ?? 'rt1' })),
            create: jest.fn((d: Partial<RefreshToken>) => d as RefreshToken),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    tenants = module.get(TenantsService);
    users = module.get(UsersService);
    jwt = module.get(JwtService);
    refreshRepo = module.get(getRepositoryToken(RefreshToken));
  });

  describe('login', () => {
    it('正しい credentials なら JWT と user を返す', async () => {
      tenants.findByKey.mockResolvedValue(tenant);
      users.findByTenantAndEmail.mockResolvedValue(user);
      jwt.signAsync.mockResolvedValue('TOKEN');

      const result = await service.login(dto);

      expect(result.accessToken).toBe('TOKEN');
      expect(result.user).toEqual({
        id: 'u1',
        name: 'Admin',
        email: dto.email,
        tenantId: 't1',
      });
      expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u1', tid: 't1' });
    });

    it('テナントが存在しないと UnauthorizedException', async () => {
      tenants.findByKey.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('ユーザーが存在しないと UnauthorizedException', async () => {
      tenants.findByKey.mockResolvedValue(tenant);
      users.findByTenantAndEmail.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('パスワードが違うと UnauthorizedException', async () => {
      tenants.findByKey.mockResolvedValue(tenant);
      users.findByTenantAndEmail.mockResolvedValue(user);

      await expect(service.login({ ...dto, password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('別テナントのユーザーは login できない（findByTenantAndEmail で限定）', async () => {
      tenants.findByKey.mockResolvedValue(tenant);
      users.findByTenantAndEmail.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);

      expect(users.findByTenantAndEmail).toHaveBeenCalledWith('t1', dto.email);
    });
  });

  describe('hashPassword', () => {
    it('bcrypt ハッシュを返す（compare で一致）', async () => {
      const hash = await service.hashPassword('mypassword');

      expect(await bcrypt.compare('mypassword', hash)).toBe(true);
      expect(await bcrypt.compare('different', hash)).toBe(false);
    });
  });

  describe('issueRefreshToken', () => {
    it('生値は返し、DB にはハッシュのみ保存する', async () => {
      const raw = await service.issueRefreshToken('u1');

      expect(raw.length).toBeGreaterThan(40);
      const saved = (refreshRepo.create.mock.calls[0] as [Partial<RefreshToken>])[0];
      expect(saved.userId).toBe('u1');
      expect(saved.tokenHash).toHaveLength(64); // sha256 hex
      expect(saved.tokenHash).not.toContain(raw);
      expect(saved.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('refresh', () => {
    it('Cookie 無しは 401', async () => {
      await expect(service.refresh(undefined)).rejects.toThrow(UnauthorizedException);
    });

    it('不明なトークンは 401', async () => {
      refreshRepo.findOne.mockResolvedValue(null);

      await expect(service.refresh('unknown-token')).rejects.toThrow(UnauthorizedException);
    });

    it('有効なトークンはローテーションして新しいアクセス/リフレッシュトークンを返す', async () => {
      const row = {
        id: 'rt1',
        userId: 'u1',
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: null,
      } as RefreshToken;
      refreshRepo.findOne.mockResolvedValue(row);
      users.findById.mockResolvedValue(user);
      jwt.signAsync.mockResolvedValue('NEW_ACCESS');

      const result = await service.refresh('valid-raw-token');

      expect(result.accessToken).toBe('NEW_ACCESS');
      expect(result.refreshToken.length).toBeGreaterThan(40);
      // 旧トークンは失効（save で revokedAt がセットされる）
      expect(row.revokedAt).toBeInstanceOf(Date);
      expect(jwt.signAsync).toHaveBeenCalledWith({ sub: 'u1', tid: 't1' });
    });

    it('期限切れトークンは 401', async () => {
      refreshRepo.findOne.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        expiresAt: new Date(Date.now() - 1000),
        revokedAt: null,
      } as RefreshToken);

      await expect(service.refresh('expired')).rejects.toThrow(UnauthorizedException);
    });

    it('猶予を過ぎた失効済みトークンの再利用は、ユーザーの全トークンを失効させて 401', async () => {
      refreshRepo.findOne.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: new Date(Date.now() - 120_000), // 猶予 60s を超過
      } as RefreshToken);

      await expect(service.refresh('reused')).rejects.toThrow(UnauthorizedException);
      expect(refreshRepo.update).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'u1' }),
        expect.objectContaining({ revokedAt: expect.any(Date) as Date }),
      );
    });

    it('猶予内の失効済みトークンは並行リフレッシュとして受け付ける', async () => {
      refreshRepo.findOne.mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        expiresAt: new Date(Date.now() + 86_400_000),
        revokedAt: new Date(Date.now() - 5_000), // 猶予 60s 以内
      } as RefreshToken);
      users.findById.mockResolvedValue(user);
      jwt.signAsync.mockResolvedValue('NEW_ACCESS');

      const result = await service.refresh('parallel');

      expect(result.accessToken).toBe('NEW_ACCESS');
    });
  });
});
