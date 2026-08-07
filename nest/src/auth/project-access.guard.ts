import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ProjectAccessService } from '../projects/project-access.service';
import type { AuthenticatedUser } from './jwt.strategy';

/**
 * ルートの対象プロジェクトを閲覧できるユーザーだけ通す Guard。
 *
 * 内部 API は `:projectId`、公開API は `:key` でプロジェクトを識別しているため両方を見る。
 * どちらも持たないルート（`GET /projects` や `POST /projects` 等）は素通しし、
 * 一覧の絞り込みは各コントローラ側で行う。
 *
 * 認証 Guard とセットで使う前提:
 * - 内部 API: `@UseGuards(JwtAuthGuard, ProjectAccessGuard)`
 * - 公開API: `@UseGuards(ApiKeyGuard, ProjectAccessGuard)`
 */
@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(private readonly access: ProjectAccessService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      params?: Record<string, string | undefined>;
    }>();
    const user = req.user;
    if (!user) throw new UnauthorizedException();

    const projectId = req.params?.projectId;
    if (projectId) {
      await this.access.assertAccess(user, projectId);
      return true;
    }

    const key = req.params?.key;
    if (key) {
      await this.access.assertAccessByKey(user, key);
      return true;
    }

    return true;
  }
}
