import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from './jwt.strategy';

/**
 * テナントの admin ロールを持つユーザーだけ通す Guard。
 * JwtAuthGuard とセットで使う前提（@UseGuards(JwtAuthGuard, AdminGuard)）。
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (req.user?.role !== 'admin') {
      throw new ForbiddenException('管理者のみ実行できます');
    }
    return true;
  }
}
