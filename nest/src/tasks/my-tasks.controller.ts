import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { TasksService } from './tasks.service';

/**
 * ホームダッシュボード用のテナント横断エンドポイント。
 * プロジェクト単位ではなくログインユーザー基準なので projects/:projectId 配下に置かない。
 */
@Controller('me/tasks')
@UseGuards(JwtAuthGuard)
export class MyTasksController {
  constructor(private readonly tasks: TasksService) {}

  /** GET /me/tasks — 自分が担当の未完了タスク（テナント横断） */
  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.tasks.listMyOpenTasks(user.tenantId, user.userId);
  }
}
