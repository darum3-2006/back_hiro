import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { UpdateUserSettingsDto } from './dto/update-user-settings.dto';
import { UsersService } from './users.service';

/**
 * ログインユーザー自身の画面設定。プロジェクトに紐づかないので projects/:projectId 配下に置かない。
 * 自分の設定しか触れないため、ユーザー管理（admin 限定）とは別のコントローラにしている。
 */
@Controller('me/settings')
@UseGuards(JwtAuthGuard)
export class MySettingsController {
  constructor(private readonly users: UsersService) {}

  /** GET /me/settings — 未設定の画面には既定値が入った状態で返る */
  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.users.getSettings(user.tenantId, user.userId);
  }

  /** PATCH /me/settings — 画面ごとの名前空間単位でマージする */
  @Patch()
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateUserSettingsDto) {
    return this.users.updateSettings(user.tenantId, user.userId, dto);
  }
}
