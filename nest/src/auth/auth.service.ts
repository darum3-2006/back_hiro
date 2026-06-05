import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import type { Tenant } from '../tenants/tenant.entity';
import type { User, UserRole } from '../users/user.entity';
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
  private readonly googleClientId: string;
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly tenants: TenantsService,
    config: ConfigService,
  ) {
    this.googleClientId = config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    this.googleClient = new OAuth2Client(this.googleClientId);
  }

  async login(dto: LoginDto): Promise<LoginResponse> {
    const tenant = await this.tenants.findByKey(dto.tenantKey);
    if (!tenant) throw new UnauthorizedException('認証に失敗しました');

    const user = await this.users.findByTenantAndEmail(tenant.id, dto.email);
    if (!user) throw new UnauthorizedException('認証に失敗しました');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('認証に失敗しました');

    return this.buildLoginResponse(user, tenant);
  }

  /**
   * Google SSO ログイン（招待制）。
   * ID トークンを検証し、メール一致で既存ユーザを特定する。
   * - 初回は (tenantId, email) で照合し、Google の sub をユーザに保存して連携。
   * - 2 回目以降は (tenantId, sub) を優先して照合（メール変更に強い）。
   * - 未登録メールはユーザを作らず拒否する。
   */
  async loginWithGoogle(dto: GoogleLoginDto): Promise<LoginResponse> {
    const tenant = await this.tenants.findByKey(dto.tenantKey);
    if (!tenant) throw new UnauthorizedException('認証に失敗しました');

    const ticket = await this.googleClient
      .verifyIdToken({ idToken: dto.idToken, audience: this.googleClientId })
      .catch(() => null);
    const payload = ticket?.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      throw new UnauthorizedException('認証に失敗しました');
    }

    const sub = payload.sub;
    const email = payload.email.toLowerCase();

    // sub 連携済みなら最優先
    let user = await this.users.findByTenantAndGoogleSub(tenant.id, sub);
    if (!user) {
      const byEmail = await this.users.findByTenantAndEmail(tenant.id, email);
      if (!byEmail) throw new UnauthorizedException('認証に失敗しました');
      // 別の Google アカウントが既に紐づくメールには連携させない
      if (byEmail.googleSub && byEmail.googleSub !== sub) {
        throw new UnauthorizedException('認証に失敗しました');
      }
      if (!byEmail.googleSub) {
        await this.users.linkGoogleSub(byEmail.id, sub);
      }
      user = byEmail;
    }

    return this.buildLoginResponse(user, tenant);
  }

  private async buildLoginResponse(user: User, tenant: Tenant): Promise<LoginResponse> {
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
