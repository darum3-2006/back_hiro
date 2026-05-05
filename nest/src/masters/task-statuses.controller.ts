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
import { CreateTaskStatusDto } from './dto/create-task-status.dto';
import { MoveDto } from './dto/move.dto';
import { ReorderDto } from './dto/reorder.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TaskStatusesService } from './task-statuses.service';

@Controller('projects/:projectId/task-statuses')
@UseGuards(JwtAuthGuard)
export class TaskStatusesController {
  constructor(private readonly statuses: TaskStatusesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ) {
    return this.statuses.listByProject(user.tenantId, projectId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateTaskStatusDto,
  ) {
    return this.statuses.create(user.tenantId, projectId, dto);
  }

  @Patch(':code')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('code') code: string,
    @Body() dto: UpdateTaskStatusDto,
  ) {
    return this.statuses.update(user.tenantId, projectId, code, dto);
  }

  @Delete(':code')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('code') code: string,
  ) {
    return this.statuses.remove(user.tenantId, projectId, code);
  }

  @Patch(':code/move')
  @HttpCode(204)
  move(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('code') code: string,
    @Body() dto: MoveDto,
  ) {
    return this.statuses.move(user.tenantId, projectId, code, dto.direction);
  }

  @Put('order')
  @HttpCode(204)
  reorder(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.statuses.reorder(user.tenantId, projectId, dto.orderedCodes);
  }
}
