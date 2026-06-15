import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { canUseApiKey, hashApiKey } from './api-key.util';
import type { AuthenticatedUser } from './jwt.strategy';

/**
 * 公開API用の認証ガード。
 * `Authorization: Bearer <api key>` を sha256 ハッシュ化して users.api_key_hash と照合し、
 * 一致したユーザーの { userId, tenantId, role } を request.user にセットする（JWT と同形）。
 * テナントはキー所有ユーザーの tenantId に固定される。
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthenticatedUser;
    }>();
    const key = this.extractKey(request.headers.authorization);
    if (!key) throw new UnauthorizedException('APIキーが指定されていません');

    const user = await this.users.findByApiKeyHash(hashApiKey(key));
    if (!user) throw new UnauthorizedException('APIキーが無効です');
    // キーは残っていても権限が下がっていれば拒否（admin / power_user のみ）
    if (!canUseApiKey(user.role)) {
      throw new ForbiddenException('このAPIキーには公開APIの利用権限がありません');
    }

    request.user = { userId: user.id, tenantId: user.tenantId, role: user.role };
    return true;
  }

  private extractKey(authorization: string | undefined): string | null {
    if (!authorization) return null;
    const [scheme, value] = authorization.split(' ');
    if (scheme !== 'Bearer' || !value) return null;
    return value.trim() || null;
  }
}
