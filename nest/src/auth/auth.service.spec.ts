import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { TenantsService } from '../tenants/tenants.service';
import type { Tenant } from '../tenants/tenant.entity';
import { UsersService } from '../users/users.service';
import type { User } from '../users/user.entity';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let tenants: jest.Mocked<TenantsService>;
  let users: jest.Mocked<UsersService>;
  let jwt: jest.Mocked<JwtService>;

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
      ],
    }).compile();

    service = module.get(AuthService);
    tenants = module.get(TenantsService);
    users = module.get(UsersService);
    jwt = module.get(JwtService);
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
});
