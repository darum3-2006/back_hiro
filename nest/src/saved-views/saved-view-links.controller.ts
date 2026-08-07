import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAccessService } from '../projects/project-access.service';
import { SavedViewsService } from './saved-views.service';

/** 共有リンク（/:tenantKey/v/:code）の解決用。projectId を持たないテナント横断の入口。 */
@Controller('saved-views')
@UseGuards(JwtAuthGuard)
export class SavedViewLinksController {
  constructor(
    private readonly savedViews: SavedViewsService,
    private readonly access: ProjectAccessService,
  ) {}

  /** GET /api/saved-views/by-code/:code — 短縮コードから projectId / viewId を解決 */
  @Get('by-code/:code')
  async resolve(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    const resolved = await this.savedViews.resolveByCode(user.tenantId, code, user);
    // 閲覧できないプロジェクトのビューはリンクを踏んでも 404（存在を伏せる）
    await this.access.assertAccess(user, resolved.projectId);
    return resolved;
  }
}
