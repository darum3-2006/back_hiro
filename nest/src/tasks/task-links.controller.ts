import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAccessService } from '../projects/project-access.service';
import { TasksService } from './tasks.service';

/**
 * 共有リンク（/:tenantKey/:shortCode）解決用。
 * projectId を含まないテナントスコープのエンドポイントなので、
 * projects/:projectId/tasks 配下の TasksController とは分けている。
 */
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TaskLinksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly access: ProjectAccessService,
  ) {}

  @Get('by-code/:code')
  async resolve(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    const resolved = await this.tasks.resolveByCode(user.tenantId, code);
    // 閲覧できないプロジェクトのタスクはリンクを踏んでも 404（存在を伏せる）
    await this.access.assertAccess(user, resolved.projectId);
    return resolved;
  }
}
