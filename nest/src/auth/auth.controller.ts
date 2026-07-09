import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { TenantsService } from '../tenants/tenants.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedUser } from './jwt.strategy';

/** リフレッシュトークンの Cookie 名。auth 配下にしか送らない（path 限定） */
const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/auth';

@Controller('auth')
export class AuthController {
  /** 本番（HTTPS）では COOKIE_SECURE=true にして平文 HTTP への送出を防ぐ */
  private readonly cookieSecure: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly tenants: TenantsService,
    config: ConfigService,
  ) {
    this.cookieSecure = config.get<string>('COOKIE_SECURE') === 'true';
  }

  // ログインは厳しく: 1分あたり 5 回まで（IP 単位）
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.login(dto);
    await this.setRefreshCookie(res, result.user.id);
    return result;
  }

  // Google SSO ログイン。パスワードログインと同様に厳しく制限する。
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('google')
  async loginWithGoogle(@Body() dto: GoogleLoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.loginWithGoogle(dto);
    await this.setRefreshCookie(res, result.user.id);
    return result;
  }

  /**
   * アクセストークンの再発行（リフレッシュトークンのローテーション付き）。
   * トークンは 384bit 乱数で総当たり不能のため、レート制限はログインより緩め
   * （オフィスの共有 IP で複数ユーザーが同時刻にリフレッシュしても弾かれない程度）。
   */
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    try {
      const { accessToken, refreshToken } = await this.auth.refresh(raw);
      res.cookie(REFRESH_COOKIE, refreshToken, this.refreshCookieOptions());
      return { accessToken };
    } catch (e) {
      // 無効な Cookie を持ち続けても意味がないので消す
      res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
      throw e;
    }
  }

  /** ログアウト。リフレッシュトークンをサーバ側で失効させ、Cookie を消す。 */
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const raw = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    await this.auth.revokeRefreshToken(raw);
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  private async setRefreshCookie(res: Response, userId: string): Promise<void> {
    const token = await this.auth.issueRefreshToken(userId);
    res.cookie(REFRESH_COOKIE, token, this.refreshCookieOptions());
  }

  private refreshCookieOptions() {
    return {
      httpOnly: true, // JS から読めない（XSS でトークンを盗めない）
      sameSite: 'lax' as const,
      secure: this.cookieSecure,
      path: REFRESH_COOKIE_PATH,
      maxAge: this.auth.refreshTokenDays * 24 * 60 * 60 * 1000,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    const u = await this.users.findById(user.userId);
    if (!u) throw new NotFoundException();
    const tenant = await this.tenants.findById(u.tenantId);
    if (!tenant) throw new NotFoundException();
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      tenantId: u.tenantId,
      role: u.role,
      tenant: { id: tenant.id, key: tenant.key, name: tenant.name },
    };
  }

  // 本人によるパスワード変更。総当たり対策で 1 分 5 回まで。
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @UseGuards(JwtAuthGuard)
  @Patch('password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.auth.changeOwnPassword(user.userId, dto.currentPassword, dto.newPassword);
  }
}
