import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { TasksService } from './tasks.service';

/**
 * グローバル検索（テナント横断）。プロジェクト非依存なので
 * projects/:projectId 配下の TasksController とは分ける。
 */
@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly tasks: TasksService) {}

  /** GET /search/tasks?q=&limit= — タイトル/説明/コード横断でタスクを検索 */
  @Get('tasks')
  searchTasks(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q = '',
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.tasks.search(user.tenantId, q, limit);
  }
}
