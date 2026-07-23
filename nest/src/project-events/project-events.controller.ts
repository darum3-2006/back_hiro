import {
  Controller,
  type MessageEvent,
  Param,
  ParseUUIDPipe,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { from, interval, map, merge, type Observable, switchMap } from 'rxjs';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectsService } from '../projects/projects.service';
import { ProjectEventsService } from './project-events.service';

@Controller('projects/:projectId/events')
@UseGuards(JwtAuthGuard)
export class ProjectEventsController {
  constructor(
    private readonly events: ProjectEventsService,
    private readonly projects: ProjectsService,
  ) {}

  /**
   * GET /api/projects/:projectId/events — データ更新イベントの SSE（EventSource）。
   * EventSource はヘッダを送れないため ?token= で認証する。25 秒ごとに ping で接続維持。
   */
  @Sse()
  stream(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Observable<MessageEvent> {
    // テナント外・不存在プロジェクトの購読を拒否してから配信を開始する
    return from(this.projects.findByIdInTenant(user.tenantId, projectId)).pipe(
      switchMap(() => {
        const events = this.events
          .stream(projectId)
          .pipe(map((e): MessageEvent => ({ type: e.type, data: e })));
        const ping = interval(25_000).pipe(map((): MessageEvent => ({ type: 'ping', data: '' })));
        return merge(events, ping);
      }),
    );
  }
}
