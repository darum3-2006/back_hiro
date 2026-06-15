import { Controller, Delete, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiAccessGuard } from '../auth/api-access.guard';
import { generateApiKey } from '../auth/api-key.util';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { UsersService } from './users.service';

/**
 * 公開APIキーの自己管理（ログインユーザー本人がキーを発行/確認/失効する）。
 * JWT 認証 + admin/power_user 権限が必要。
 * 平文キーは発行(POST)時に一度だけ返し、以後は表示用プレフィックスのみ。
 */
@Controller('users/me/api-key')
@UseGuards(JwtAuthGuard, ApiAccessGuard)
export class ApiKeysController {
  constructor(private readonly users: UsersService) {}

  /** 現在のキー情報（平文は返さない。未発行なら issued=false）。 */
  @Get()
  async info(@CurrentUser() user: AuthenticatedUser) {
    const found = await this.users.findById(user.userId);
    if (!found?.apiKeyHash) return { issued: false };
    return { issued: true, prefix: found.apiKeyPrefix, createdAt: found.apiKeyCreatedAt };
  }

  /** キーを発行/再生成する。平文をこの応答でのみ返す（旧キーは失効）。 */
  @Post()
  async regenerate(@CurrentUser() user: AuthenticatedUser) {
    const key = generateApiKey();
    await this.users.setApiKey(user.userId, key.hash, key.prefix);
    return { apiKey: key.plaintext, prefix: key.prefix };
  }

  /** キーを失効させる。 */
  @Delete()
  @HttpCode(204)
  revoke(@CurrentUser() user: AuthenticatedUser) {
    return this.users.clearApiKey(user.userId);
  }
}
