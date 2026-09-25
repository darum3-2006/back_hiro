import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAccessService } from '../projects/project-access.service';
import { UsersService } from '../users/users.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { TasksService } from './tasks.service';

/**
 * ダッシュボード用のプロジェクト横断エンドポイント。
 * ルートに projectId が無く Guard で塞げないため、閲覧できるプロジェクトへ明示的に絞る。
 */
@Controller('me/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private readonly tasks: TasksService,
    private readonly access: ProjectAccessService,
    private readonly users: UsersService,
  ) {}

  /**
   * GET /me/dashboard/due — 期限切れ / 期限間近のタスク。
   * 基準日付と期限間近日数はユーザー設定を既定にし、クエリで上書きできる
   * （設定を保存する前のプレビューに使う）。
   */
  @Get('due')
  async due(@CurrentUser() user: AuthenticatedUser, @Query() query: DashboardQueryDto) {
    const settings = await this.users.getSettings(user.tenantId, user.userId);
    return this.tasks.listDueTasks(user.tenantId, await this.access.accessibleProjectIds(user), {
      dateField: query.dateField ?? settings.dashboard.dateField,
      dueSoonDays: query.dueSoonDays ?? settings.dashboard.dueSoonDays,
    });
  }

  /**
   * GET /me/dashboard/inactive — ステータスが一定日数変わっていないタスク。
   * 日数はユーザー設定を既定にし、クエリで上書きできる。
   */
  @Get('inactive')
  async inactive(@CurrentUser() user: AuthenticatedUser, @Query() query: DashboardQueryDto) {
    const settings = await this.users.getSettings(user.tenantId, user.userId);
    return this.tasks.listInactiveTasks(
      user.tenantId,
      await this.access.accessibleProjectIds(user),
      { inactiveDays: query.inactiveDays ?? settings.dashboard.inactiveDays },
    );
  }
}
