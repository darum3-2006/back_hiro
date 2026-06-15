import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { TaskPrioritiesService } from '../masters/task-priorities.service';
import { TaskStatusesService } from '../masters/task-statuses.service';
import { TagsService } from '../masters/tags.service';
import { FlagsService } from '../masters/flags.service';
import { MembersService } from '../members/members.service';
import { ProjectsService } from '../projects/projects.service';
import {
  PublicFlag,
  PublicMember,
  PublicTag,
  PublicTaskPriority,
  PublicTaskStatus,
  toPublicFlag,
  toPublicMember,
  toPublicTag,
  toPublicTaskPriority,
  toPublicTaskStatus,
} from './dto/public-master';

/**
 * 公開API: タスクの code/id を解決するためのプロジェクト単位マスタ（読み取り専用）。
 * Task のコード（statusCode 等）/ メンバー ID の表示名解決に使う。
 */
@Controller('v1/projects/:key')
@UseGuards(ApiKeyGuard)
export class PublicMastersController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly statuses: TaskStatusesService,
    private readonly priorities: TaskPrioritiesService,
    private readonly tags: TagsService,
    private readonly flags: FlagsService,
    private readonly members: MembersService,
  ) {}

  @Get('statuses')
  async listStatuses(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
  ): Promise<PublicTaskStatus[]> {
    const project = await this.projects.findByKeyInTenant(user.tenantId, key);
    const rows = await this.statuses.listByProject(user.tenantId, project.id);
    return rows.map(toPublicTaskStatus);
  }

  @Get('priorities')
  async listPriorities(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
  ): Promise<PublicTaskPriority[]> {
    const project = await this.projects.findByKeyInTenant(user.tenantId, key);
    const rows = await this.priorities.listByProject(user.tenantId, project.id);
    return rows.map(toPublicTaskPriority);
  }

  @Get('tags')
  async listTags(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
  ): Promise<PublicTag[]> {
    const project = await this.projects.findByKeyInTenant(user.tenantId, key);
    const rows = await this.tags.listByProject(user.tenantId, project.id);
    return rows.map(toPublicTag);
  }

  @Get('flags')
  async listFlags(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
  ): Promise<PublicFlag[]> {
    const project = await this.projects.findByKeyInTenant(user.tenantId, key);
    const rows = await this.flags.listByProject(user.tenantId, project.id);
    return rows.map(toPublicFlag);
  }

  @Get('members')
  async listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
  ): Promise<PublicMember[]> {
    const project = await this.projects.findByKeyInTenant(user.tenantId, key);
    const rows = await this.members.listByProject(user.tenantId, project.id);
    return rows.map(toPublicMember);
  }
}
