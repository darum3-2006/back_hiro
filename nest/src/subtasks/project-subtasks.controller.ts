import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAccessGuard } from '../auth/project-access.guard';
import { SubtasksService } from './subtasks.service';

/** プロジェクト横断のサブタスク一覧（タスク一覧の子行用）。 */
@Controller('projects/:projectId/subtasks')
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
export class ProjectSubtasksController {
  constructor(private readonly subtasks: SubtasksService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.subtasks.listByProject(user.tenantId, projectId);
  }

  /** GET /api/projects/:projectId/subtasks/count?flagCode= — フラグ操作の対象件数用 */
  @Get('count')
  async count(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query('flagCode') flagCode?: string,
  ) {
    return { count: await this.subtasks.countByProject(user.tenantId, projectId, flagCode) };
  }
}
