import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { AllowReadonly } from '../auth/allow-readonly.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAccessGuard } from '../auth/project-access.guard';
import { ProjectAccessService } from '../projects/project-access.service';
import { TaskViewsService } from './task-views.service';

/**
 * 閲覧の記録。タスクに紐づくので projects/:projectId 配下に置き、
 * ProjectAccessGuard で「見られないタスクの閲覧を記録させない」をそのまま効かせる。
 */
@Controller('projects/:projectId/tasks/:taskId/view')
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
export class TaskViewRecordController {
  constructor(private readonly views: TaskViewsService) {}

  /**
   * POST /projects/:projectId/tasks/:taskId/view — タスクの詳細を開いたときに呼ぶ。
   * 自分の閲覧の記録で、プロジェクトのデータは変えないので閲覧のみの人にも許可する。
   * 付けないと readonly の人の閲覧が記録されず、画面側は失敗を握りつぶすので気づけない。
   */
  @Post()
  @HttpCode(204)
  @AllowReadonly()
  async record(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
  ): Promise<void> {
    await this.views.record(user.tenantId, user.userId, projectId, taskId);
  }
}

/**
 * 自分の閲覧履歴（プロジェクト横断）。ルートに projectId が無く Guard で塞げないため、
 * 閲覧できるプロジェクトへ明示的に絞る。
 */
@Controller('me/task-views')
@UseGuards(JwtAuthGuard)
export class MyTaskViewsController {
  constructor(
    private readonly views: TaskViewsService,
    private readonly access: ProjectAccessService,
  ) {}

  /** GET /me/task-views — 新しい順、直近 30 件まで */
  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.views.listMine(
      user.tenantId,
      user.userId,
      await this.access.accessibleProjectIds(user),
    );
  }
}
