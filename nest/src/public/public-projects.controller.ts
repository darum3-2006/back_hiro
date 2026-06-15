import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectsService } from '../projects/projects.service';
import { PublicProject, toPublicProject } from './dto/public-project';

/** 公開API: プロジェクト一覧（APIキー所有ユーザーのテナント、アーカイブ済みは除外）。 */
@Controller('v1/projects')
@UseGuards(ApiKeyGuard)
export class PublicProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<PublicProject[]> {
    const projects = await this.projects.listByTenant(user.tenantId);
    return projects.filter((p) => p.archivedAt === null).map(toPublicProject);
  }
}
