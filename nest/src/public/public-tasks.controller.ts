import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAccessGuard } from '../auth/project-access.guard';
import { TaskStatusesService } from '../masters/task-statuses.service';
import { MembersService } from '../members/members.service';
import type { Project } from '../projects/project.entity';
import { ProjectsService } from '../projects/projects.service';
import { TaskFilterDto } from '../tasks/dto/task-filter.dto';
import { TasksService } from '../tasks/tasks.service';
import {
  PublicCreateTaskDto,
  PublicSetTaskMemberDto,
  PublicSetTaskStatusDto,
  PublicUpdateTaskDto,
} from './dto/public-task-input';
import { PublicTask, toPublicTask } from './dto/public-task';

/**
 * 公開API: タスク。
 * プロジェクトは key、タスクはプロジェクト内連番(seq)で識別する。
 * - 読み取り: 一覧 / 単体
 * - 書き込み: 作成 / 部分更新（ステータス・担当者は対象外）
 * - アクション: POST /{seq}/status（ステータス変更）・POST /{seq}/member（担当者割り当て）
 * DELETE は提供しない。
 */
@Controller('v1/projects/:key/tasks')
@UseGuards(ApiKeyGuard, ProjectAccessGuard)
export class PublicTasksController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly tasks: TasksService,
    private readonly statuses: TaskStatusesService,
    private readonly members: MembersService,
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

  /**
   * タスク作成。ステータスはステータスマスタの先頭（order 最小）を自動セットする
   * （フロントの作成画面の初期値と同じ）。担当者は POST /{seq}/member で割り当てる。
   */
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: PublicCreateTaskDto,
  ): Promise<PublicTask> {
    const project = await this.projects.findByKeyInTenant(user.tenantId, key);
    this.assertNotArchived(project);
    const statuses = await this.statuses.listByProject(user.tenantId, project.id);
    const first = statuses[0];
    if (!first) {
      throw new BadRequestException('ステータスマスタが未定義のためタスクを作成できません');
    }
    if (dto.requesterMemberId) {
      await this.assertMemberInProject(user.tenantId, project.id, dto.requesterMemberId);
    }
    const created = await this.tasks.create(
      user.tenantId,
      project.id,
      { ...dto, statusCode: first.code },
      user.userId,
    );
    return toPublicTask(created);
  }

  /** 部分更新。ステータス・担当者は対象外（専用アクションを使う）。 */
  @Patch(':seq')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Param('seq', ParseIntPipe) seq: number,
    @Body() dto: PublicUpdateTaskDto,
  ): Promise<PublicTask> {
    const project = await this.projects.findByKeyInTenant(user.tenantId, key);
    const task = await this.tasks.findBySeqInProject(user.tenantId, project.id, seq);
    if (dto.requesterMemberId) {
      await this.assertMemberInProject(user.tenantId, project.id, dto.requesterMemberId);
    }
    const updated = await this.tasks.update(user.tenantId, project.id, task.id, dto, user.userId);
    return toPublicTask(updated);
  }

  /**
   * ステータス変更。マスタに存在しないコードは 400。
   * 内部の更新処理を経由するため、完了日時の管理・監査ログ・通知・
   * サブタスク未完了時の終端化ガード（400）がそのまま効く。
   */
  @Post(':seq/status')
  @HttpCode(200)
  async setStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Param('seq', ParseIntPipe) seq: number,
    @Body() dto: PublicSetTaskStatusDto,
  ): Promise<PublicTask> {
    const project = await this.projects.findByKeyInTenant(user.tenantId, key);
    const task = await this.tasks.findBySeqInProject(user.tenantId, project.id, seq);
    const statuses = await this.statuses.listByProject(user.tenantId, project.id);
    if (!statuses.some((s) => s.code === dto.statusCode)) {
      throw new BadRequestException('指定されたステータスコードはこのプロジェクトに存在しません');
    }
    const updated = await this.tasks.update(
      user.tenantId,
      project.id,
      task.id,
      { statusCode: dto.statusCode },
      user.userId,
    );
    return toPublicTask(updated);
  }

  /** 担当者割り当て。memberId が null / 省略なら担当なしに戻す。 */
  @Post(':seq/member')
  @HttpCode(200)
  async setMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Param('seq', ParseIntPipe) seq: number,
    @Body() dto: PublicSetTaskMemberDto,
  ): Promise<PublicTask> {
    const project = await this.projects.findByKeyInTenant(user.tenantId, key);
    const task = await this.tasks.findBySeqInProject(user.tenantId, project.id, seq);
    const memberId = dto.memberId ?? null;
    if (memberId) {
      await this.assertMemberInProject(user.tenantId, project.id, memberId);
    }
    const updated = await this.tasks.update(
      user.tenantId,
      project.id,
      task.id,
      { assigneeMemberId: memberId },
      user.userId,
    );
    return toPublicTask(updated);
  }

  private assertNotArchived(project: Project): void {
    if (project.archivedAt !== null) {
      throw new BadRequestException('アーカイブ済みプロジェクトにはタスクを作成できません');
    }
  }

  private async assertMemberInProject(
    tenantId: string,
    projectId: string,
    memberId: string,
  ): Promise<void> {
    const members = await this.members.listByProject(tenantId, projectId);
    if (!members.some((m) => m.id === memberId)) {
      throw new BadRequestException('指定されたメンバーはこのプロジェクトに存在しません');
    }
  }
}
