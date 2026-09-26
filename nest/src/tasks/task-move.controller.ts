import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAccessGuard } from '../auth/project-access.guard';
import { MoveTaskDto } from './dto/move-task.dto';
import { TaskMoveService } from './task-move.service';

/**
 * タスクのプロジェクト間移動（設計: docs/TASK_MOVE.md）。
 * 移動元は ProjectAccessGuard（:projectId）で、移動先は TaskMoveService で権限を確かめる。
 * 処理はサービスに置き、ここは薄くする（公開 API を足すときに同じサービスを呼べるように）。
 */
@Controller('projects/:projectId/tasks/:taskId')
@UseGuards(JwtAuthGuard, ProjectAccessGuard)
export class TaskMoveController {
  constructor(private readonly moves: TaskMoveService) {}

  /** GET /projects/:projectId/tasks/:taskId/move-preview?to=:targetProjectId — 失われるもの等の事前確認 */
  @Get('move-preview')
  preview(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Query('to', new ParseUUIDPipe()) targetProjectId: string,
  ) {
    return this.moves.preview(user, projectId, taskId, targetProjectId);
  }

  /** POST /projects/:projectId/tasks/:taskId/move — 移動する（元に戻せない） */
  @Post('move')
  move(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() dto: MoveTaskDto,
  ) {
    return this.moves.move(user, projectId, taskId, dto);
  }
}
