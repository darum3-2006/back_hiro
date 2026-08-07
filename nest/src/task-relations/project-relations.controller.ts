import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAccessGuard } from '../auth/project-access.guard';
import { TaskRelationsService } from './task-relations.service';

/** プロジェクト横断の関連一覧（ガントのハイライト / 依存違反表示用）。 */
@Controller('projects/:projectId/relations')
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
export class ProjectRelationsController {
  constructor(private readonly relations: TaskRelationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.relations.listByProject(user.tenantId, projectId);
  }
}
