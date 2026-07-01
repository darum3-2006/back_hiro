import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { ReorderSubtasksDto } from './dto/reorder-subtasks.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { SubtasksService } from './subtasks.service';

@Controller('projects/:projectId/tasks/:taskId/subtasks')
@UseGuards(JwtAuthGuard)
export class SubtasksController {
  constructor(private readonly subtasks: SubtasksService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.subtasks.listByTask(user.tenantId, projectId, taskId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() dto: CreateSubtaskDto,
  ) {
    return this.subtasks.create(user.tenantId, projectId, taskId, dto, user.userId);
  }

  // ':id' より前に宣言する（'reorder' が :id の ParseUUIDPipe に捕まらないように）
  @Patch('reorder')
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() dto: ReorderSubtasksDto,
  ) {
    return this.subtasks.reorder(user.tenantId, projectId, taskId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSubtaskDto,
  ) {
    return this.subtasks.update(user.tenantId, projectId, taskId, id, dto, user.userId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.subtasks.remove(user.tenantId, projectId, taskId, id, user.userId);
  }
}
