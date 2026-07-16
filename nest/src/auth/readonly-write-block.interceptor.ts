import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ALLOW_READONLY_KEY } from './allow-readonly.decorator';
import { AuthenticatedUser } from './jwt.strategy';

/** 副作用のない HTTP メソッド（readonly でも常に許可） */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * readonly（閲覧のみ）ユーザーの書き込み系リクエストを一括で 403 にする。
 *
 * ガードではなくグローバルインターセプタにしている理由:
 * APP_GUARD はコントローラ付与の JwtAuthGuard より先に実行されるため req.user を参照できない。
 * インターセプタは全ガード通過後に実行されるので、認証済みユーザーの role で判定できる。
 *
 * 新しい書き込みエンドポイントはデフォルトで拒否対象になる（安全側に倒す）。
 * readonly にも許可したい場合のみ @AllowReadonly() を付け、必要な追加制約
 * （例: 保存ビューは private のみ）は各 Service 側で担保する。
 */
@Injectable()
export class ReadonlyWriteBlockInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<{ method: string; user?: AuthenticatedUser }>();

    if (SAFE_METHODS.has(request.method)) return next.handle();
    // 未認証エンドポイント（login / refresh 等）は user が無いので対象外
    if (request.user?.role !== 'readonly') return next.handle();

    const allowed = this.reflector.getAllAndOverride<boolean>(ALLOW_READONLY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (allowed) return next.handle();

    throw new ForbiddenException('閲覧専用ユーザーのため、この操作はできません');
  }
}
