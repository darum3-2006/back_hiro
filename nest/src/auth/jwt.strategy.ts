import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { UserRole } from '../users/user.entity';
import { UsersService } from '../users/users.service';

export interface JwtPayload {
  /** subject = userId */
  sub: string;
  /** tenantId */
  tid: string;
}

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  role: UserRole;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      // 通常は Authorization ヘッダ。SSE(EventSource)はヘッダを付けられないため
      // クエリ ?token= もフォールバックで受け付ける。
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.users.findById(payload.sub);
    // 無効化されたユーザーは発行済みトークンが残っていても即座に拒否する
    if (!user || user.tenantId !== payload.tid || !user.isActive) {
      throw new UnauthorizedException();
    }
    return { userId: payload.sub, tenantId: payload.tid, role: user.role };
  }
}
