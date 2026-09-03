import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAccessService } from '../projects/project-access.service';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { PublicTask, toPublicTask } from './dto/public-task';

/**
 * 公開API: 共有リンクの短縮コード（グローバル一意）でタスクを引く。
 * プロジェクト key を含まないテナントスコープのエンドポイントなので、
 * v1/projects/:key/tasks 配下の PublicTasksController とは分けている
 * （内部 API の TaskLinksController と同じ構成）。
 */
@Controller('v1/tasks')
@UseGuards(ApiKeyGuard)
export class PublicTaskLookupController {
  constructor(
    private readonly tasks: TasksService,
    private readonly projects: ProjectsService,
    private readonly access: ProjectAccessService,
  ) {}

  /** 応答には projectKey を含め、seq ベースの既存エンドポイントへ繋げられるようにする。 */
  @Get('short/:shortCode')
  async byShortCode(
    @CurrentUser() user: AuthenticatedUser,
    @Param('shortCode') shortCode: string,
  ): Promise<PublicTask & { projectKey: string }> {
    const resolved = await this.tasks.resolveByCode(user.tenantId, shortCode);
    // 閲覧できないプロジェクトのタスクは 404（存在を伏せる）
    await this.access.assertAccess(user, resolved.projectId);
    const [task, project] = await Promise.all([
      this.tasks.findInProject(user.tenantId, resolved.projectId, resolved.id),
      this.projects.findByIdInTenant(user.tenantId, resolved.projectId),
    ]);
    return { ...toPublicTask(task), projectKey: project.key };
  }
}
