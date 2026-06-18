import {
  Body,
  Controller,
  Get,
  HttpCode,
  type MessageEvent,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { interval, map, merge, type Observable } from 'rxjs';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { UpdateNotificationPreferenceDto } from './dto/update-notification-preference.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  /** GET /api/notifications — 自分宛の通知（新着順） */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query('limit') limit?: string) {
    const n = limit ? Math.min(Math.max(Number(limit) || 30, 1), 100) : 30;
    return this.notifications.listForUser(user.tenantId, user.userId, n);
  }

  /**
   * GET /api/notifications/stream — SSE で新着通知を push（EventSource）。
   * EventSource はヘッダを送れないため ?token= で認証する。25 秒ごとに ping で接続維持。
   */
  @Sse('stream')
  stream(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    const notifs = this.notifications
      .stream(user.userId)
      .pipe(map((n): MessageEvent => ({ data: n })));
    const ping = interval(25_000).pipe(map((): MessageEvent => ({ type: 'ping', data: '' })));
    return merge(notifs, ping);
  }

  /** GET /api/notifications/unread-count */
  @Get('unread-count')
  async unreadCount(@CurrentUser() user: AuthenticatedUser) {
    return { count: await this.notifications.unreadCount(user.tenantId, user.userId) };
  }

  /** GET /api/notifications/preferences — 全タイプの ON/OFF（マイページ通知タブ） */
  @Get('preferences')
  preferences(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.getPreferences(user.userId);
  }

  /** PATCH /api/notifications/preferences — 1 タイプの ON/OFF を更新し全件返す */
  @Patch('preferences')
  setPreference(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateNotificationPreferenceDto,
  ) {
    return this.notifications.setPreference(user.userId, dto.type, dto.enabled);
  }

  /** POST /api/notifications/read-all — 全部既読化 */
  @Post('read-all')
  @HttpCode(204)
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notifications.markAllRead(user.tenantId, user.userId);
  }

  /** PATCH /api/notifications/:id/read — 1 件既読化 */
  @Patch(':id/read')
  @HttpCode(204)
  markRead(@CurrentUser() user: AuthenticatedUser, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.notifications.markRead(user.tenantId, user.userId, id);
  }
}
