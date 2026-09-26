import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectAccessService } from '../projects/project-access.service';
import { ALLOW_READONLY_KEY } from './allow-readonly.decorator';
import { PROJECT_MANAGEMENT_KEY } from './project-management.decorator';
import type { AuthenticatedUser } from './jwt.strategy';

/** 副作用のない HTTP メソッド（閲覧のみの人でも常に許可） */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * ルートの対象プロジェクトについて、閲覧と編集の可否を判定する Guard。
 *
 * 1. 閲覧: 閲覧権が無ければ 404（見えないプロジェクトの存在自体を伏せる）
 * 2. 編集: 書き込み系のリクエスト（GET / HEAD / OPTIONS 以外）は、そのプロジェクトの
 *    ProjectMember でなければ 403（テナント admin も同じ）。閲覧権はあるがメンバーでない人は
 *    「このプロジェクトは見るだけ」になる。`@ProjectManagement()` が付いた管理操作だけは、
 *    テナント admin ならメンバーでなくても通す
 *
 * 新しい書き込みエンドポイントは既定で 2 の対象になる（安全側に倒す）。本人だけに関わる操作
 * （private の保存ビューなど）は `@AllowReadonly()` を付けると、メンバーでなくても通る。
 * readonly ロールの書き込みは ReadonlyWriteBlockInterceptor が別途止める。
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
  constructor(
    private readonly access: ProjectAccessService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{
      method: string;
      user?: AuthenticatedUser;
      params?: Record<string, string | undefined>;
    }>();
    const user = req.user;
    if (!user) throw new UnauthorizedException();

    const needsEditor = !SAFE_METHODS.has(req.method) && !this.flag(ctx, ALLOW_READONLY_KEY);
    const options = { management: this.flag(ctx, PROJECT_MANAGEMENT_KEY) };

    const projectId = req.params?.projectId;
    if (projectId) {
      await this.access.assertAccess(user, projectId);
      if (needsEditor) await this.access.assertEditor(user, projectId, options);
      return true;
    }

    const key = req.params?.key;
    if (key) {
      await this.access.assertAccessByKey(user, key);
      if (needsEditor) await this.access.assertEditorByKey(user, key, options);
      return true;
    }

    return true;
  }

  /**
   * ハンドラ（またはクラス）に付いた印を読む。
   * - `@AllowReadonly()`: 閲覧のみの人（メンバーでない人）にも書き込みを許す
   * - `@ProjectManagement()`: 管理操作。テナント admin はメンバーでなくても通す
   */
  private flag(ctx: ExecutionContext, key: string): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(key, [ctx.getHandler(), ctx.getClass()]) ?? false
    );
  }
}
