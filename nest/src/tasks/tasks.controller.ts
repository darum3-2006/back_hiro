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
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@Controller('projects/:projectId/tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() filter: TaskFilterDto,
  ) {
    return this.tasks.listByProject(user.tenantId, projectId, filter);
  }

  @Get('count')
  async count(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() filter: TaskFilterDto,
  ) {
    return { count: await this.tasks.count(user.tenantId, projectId, filter) };
  }

  @Get(':id')
  find(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tasks.findInProject(user.tenantId, projectId, id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(user.tenantId, projectId, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(user.tenantId, projectId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.tasks.remove(user.tenantId, projectId, id);
  }
}
