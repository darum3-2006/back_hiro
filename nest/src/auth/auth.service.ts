import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import type { UserRole } from '../users/user.entity';
import { JwtPayload } from './jwt.strategy';

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    tenantId: string;
    role: UserRole;
  };
  tenant: {
    id: string;
    key: string;
    name: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly tenants: TenantsService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const tenant = await this.tenants.findByKey(dto.tenantKey);
    if (!tenant) throw new UnauthorizedException('認証に失敗しました');

    const user = await this.users.findByTenantAndEmail(tenant.id, dto.email);
    if (!user) throw new UnauthorizedException('認証に失敗しました');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('認証に失敗しました');

    const payload: JwtPayload = { sub: user.id, tid: user.tenantId };
    const accessToken = await this.jwt.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        tenantId: user.tenantId,
        role: user.role,
      },
      tenant: { id: tenant.id, key: tenant.key, name: tenant.name },
    };
  }

  hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }

  /**
   * 本人によるパスワード変更。
   * 現在パスワードを照合してから新しいパスワードに上書きする。
   */
  async changeOwnPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('認証に失敗しました');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('現在のパスワードが正しくありません');

    await this.users.setPassword(user.id, newPassword);
  }
}
