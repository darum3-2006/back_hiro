import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAccessService } from '../projects/project-access.service';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { PublicTask, toPublicTask } from './dto/public-task';
import { PublicTaskSearchQueryDto } from './dto/public-task-search';

/**
 * 公開API: プロジェクト横断でタスクを引く（短縮コード / キーワード検索）。
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

  /**
   * キーワード検索（画面のグローバル検索と同じ条件・並び順）。閲覧できるプロジェクトに絞る。
   * 応答は各件に projectKey を付け、seq ベースの既存エンドポイントへ繋げられるようにする。
   */
  @Get('search')
  async search(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PublicTaskSearchQueryDto,
  ): Promise<Array<PublicTask & { projectKey: string }>> {
    const hits = await this.tasks.searchWithDetails(
      user.tenantId,
      query.q ?? '',
      query.limit ?? 20,
      await this.access.accessibleProjectIds(user),
    );
    return hits.map((t) => ({ ...toPublicTask(t), projectKey: t.projectKey }));
  }
}
