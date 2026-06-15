import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectsService } from '../projects/projects.service';
import { TaskFilterDto } from '../tasks/dto/task-filter.dto';
import { TasksService } from '../tasks/tasks.service';
import { PublicTask, toPublicTask } from './dto/public-task';

/**
 * 公開API: タスク（読み取り専用）。
 * プロジェクトは key、タスクはプロジェクト内連番(seq)で識別する。
 */
@Controller('v1/projects/:key/tasks')
@UseGuards(ApiKeyGuard)
export class PublicTasksController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly tasks: TasksService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Query() filter: TaskFilterDto,
  ): Promise<PublicTask[]> {
    const project = await this.projects.findByKeyInTenant(user.tenantId, key);
    const tasks = await this.tasks.listByProject(user.tenantId, project.id, filter);
    return tasks.map(toPublicTask);
  }

  @Get(':seq')
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Param('seq', ParseIntPipe) seq: number,
  ): Promise<PublicTask> {
    const project = await this.projects.findByKeyInTenant(user.tenantId, key);
    const task = await this.tasks.findBySeqInProject(user.tenantId, project.id, seq);
    return toPublicTask(task);
  }
}
