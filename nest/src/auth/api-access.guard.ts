import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { canUseApiKey } from './api-key.util';
import type { AuthenticatedUser } from './jwt.strategy';

/**
 * 公開APIキーの発行・管理を許可するロール（admin / power_user）だけ通す Guard。
 * JwtAuthGuard とセットで使う（@UseGuards(JwtAuthGuard, ApiAccessGuard)）。
 */
@Injectable()
export class ApiAccessGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!req.user || !canUseApiKey(req.user.role)) {
      throw new ForbiddenException('APIキーの利用には Power User 以上の権限が必要です');
    }
    return true;
  }
}
