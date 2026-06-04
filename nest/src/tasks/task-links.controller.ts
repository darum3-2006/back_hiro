import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { TasksService } from './tasks.service';

/**
 * 共有リンク（/:tenantKey/:shortCode）解決用。
 * projectId を含まないテナントスコープのエンドポイントなので、
 * projects/:projectId/tasks 配下の TasksController とは分けている。
 */
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TaskLinksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('by-code/:code')
  resolve(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    return this.tasks.resolveByCode(user.tenantId, code);
  }
}
