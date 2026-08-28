import { createHash, randomBytes } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { IsNull, LessThan, Repository } from 'typeorm';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshToken } from './refresh-token.entity';
import type { Tenant } from '../tenants/tenant.entity';
import type { User, UserRole } from '../users/user.entity';
import { JwtPayload } from './jwt.strategy';

/**
 * ローテーション済みトークンの再利用を許容する猶予（ms）。
 * リフレッシュトークンの Cookie はブラウザ全体で共有されるため、複数タブが
 * 同時にリフレッシュすると後着が「失効直後の旧トークン」を出すことがある。
 * 猶予内は並行リフレッシュとみなして受け付け、猶予を過ぎた再利用は盗難の
 * 疑いとしてそのユーザーの全トークンを失効させる。
 */
const REUSE_GRACE_MS = 60_000;

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
  /** リフレッシュトークンの有効期限（日）。使用のたびにここまでスライド延長する */
  readonly refreshTokenDays: number;

  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly tenants: TenantsService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokens: Repository<RefreshToken>,
    config: ConfigService,
  ) {
    this.googleClientId = config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    this.googleClient = new OAuth2Client(this.googleClientId);
    this.refreshTokenDays = Number(config.get<string>('REFRESH_TOKEN_EXPIRES_DAYS') ?? 7);
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
    // パスワード / Google 共通の最終チェック。資格情報の検証は通過済みなので
    // 無効化されている旨を明示して返してよい
    if (!user.isActive) {
      throw new UnauthorizedException('このアカウントは無効化されています');
    }
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

  // ===== リフレッシュトークン =====

  /**
   * リフレッシュトークンを新規発行する（ログイン時・ローテーション時）。
   * 生値は返すだけで保存せず、SHA-256 ハッシュのみ DB に持つ。
   * ついでに期限切れ行を掃除する（テーブル肥大防止のベストエフォート）。
   */
  async issueRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(48).toString('base64url');
    await this.refreshTokens.save(
      this.refreshTokens.create({
        userId,
        tokenHash: this.hashRefreshToken(raw),
        expiresAt: new Date(Date.now() + this.refreshTokenDays * 24 * 60 * 60 * 1000),
        revokedAt: null,
      }),
    );
    await this.refreshTokens.delete({ userId, expiresAt: LessThan(new Date()) });
    return raw;
  }

  /**
   * リフレッシュトークンを検証してローテーションし、新しいアクセストークンと
   * リフレッシュトークンを返す（スライド延長）。
   * - 不明 / 期限切れ → 401
   * - 失効済みの再利用 → 猶予内は並行リフレッシュとして許容、猶予超過は全失効 + 401
   */
  async refresh(
    rawToken: string | undefined,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!rawToken) throw new UnauthorizedException('認証に失敗しました');
    const row = await this.refreshTokens.findOne({
      where: { tokenHash: this.hashRefreshToken(rawToken) },
    });
    if (!row) throw new UnauthorizedException('認証に失敗しました');
    const now = Date.now();
    if (row.expiresAt.getTime() < now) throw new UnauthorizedException('認証に失敗しました');
    if (row.revokedAt) {
      if (now - row.revokedAt.getTime() > REUSE_GRACE_MS) {
        // 猶予を過ぎた再利用 = 盗難の疑い。ユーザーの有効なトークンを全失効させる
        await this.refreshTokens.update(
          { userId: row.userId, revokedAt: IsNull() },
          { revokedAt: new Date() },
        );
        throw new UnauthorizedException('認証に失敗しました');
      }
      // 猶予内: 複数タブの並行リフレッシュとみなして続行（この行は失効済みのまま）
    } else {
      row.revokedAt = new Date();
      await this.refreshTokens.save(row);
    }

    const user = await this.users.findById(row.userId);
    if (!user || !user.isActive) throw new UnauthorizedException('認証に失敗しました');

    const payload: JwtPayload = { sub: user.id, tid: user.tenantId };
    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = await this.issueRefreshToken(user.id);
    return { accessToken, refreshToken };
  }

  /** ログアウト時にリフレッシュトークンを失効させる（Cookie 未所持なら何もしない）。 */
  async revokeRefreshToken(rawToken: string | undefined): Promise<void> {
    if (!rawToken) return;
    await this.refreshTokens.update(
      { tokenHash: this.hashRefreshToken(rawToken), revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
  }

  private hashRefreshToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
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
