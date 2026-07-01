import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { SubtasksService } from './subtasks.service';

/** プロジェクト横断のサブタスク一覧（タスク一覧の子行用）。 */
@Controller('projects/:projectId/subtasks')
@UseGuards(JwtAuthGuard)
export class ProjectSubtasksController {
  constructor(private readonly subtasks: SubtasksService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.subtasks.listByProject(user.tenantId, projectId);
  }
}
