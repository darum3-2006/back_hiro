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
  Put,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateTaskPriorityDto } from './dto/create-task-priority.dto';
import { MoveDto } from './dto/move.dto';
import { ReorderDto } from './dto/reorder.dto';
import { UpdateTaskPriorityDto } from './dto/update-task-priority.dto';
import { TaskPrioritiesService } from './task-priorities.service';

@Controller('projects/:projectId/task-priorities')
@UseGuards(JwtAuthGuard)
export class TaskPrioritiesController {
  constructor(private readonly priorities: TaskPrioritiesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.priorities.listByProject(user.tenantId, projectId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateTaskPriorityDto,
  ) {
    return this.priorities.create(user.tenantId, projectId, dto);
  }

  @Patch(':code')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('code') code: string,
    @Body() dto: UpdateTaskPriorityDto,
  ) {
    return this.priorities.update(user.tenantId, projectId, code, dto);
  }

  @Delete(':code')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('code') code: string,
  ) {
    return this.priorities.remove(user.tenantId, projectId, code);
  }

  @Patch(':code/move')
  @HttpCode(204)
  move(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('code') code: string,
    @Body() dto: MoveDto,
  ) {
    return this.priorities.move(user.tenantId, projectId, code, dto.direction);
  }

  @Put('order')
  @HttpCode(204)
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.priorities.reorder(user.tenantId, projectId, dto.orderedCodes);
  }
}
