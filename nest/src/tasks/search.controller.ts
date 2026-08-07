import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAccessService } from '../projects/project-access.service';
import { TasksService } from './tasks.service';

/**
 * グローバル検索（テナント横断）。プロジェクト非依存なので
 * projects/:projectId 配下の TasksController とは分ける。
 * ルートに projectId が無く Guard で塞げないため、閲覧できるプロジェクトへ明示的に絞る。
 */
@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(
    private readonly tasks: TasksService,
    private readonly access: ProjectAccessService,
  ) {}

  /** GET /search/tasks?q=&limit= — タイトル/説明/コード横断でタスクを検索 */
  @Get('tasks')
  async searchTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q = '',
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.tasks.search(user.tenantId, q, limit, await this.access.accessibleProjectIds(user));
  }
}
