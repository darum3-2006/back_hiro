import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectAccessGuard } from '../auth/project-access.guard';
import { CommentsService } from '../comments/comments.service';
import { MembersService } from '../members/members.service';
import { ProjectsService } from '../projects/projects.service';
import { TasksService } from '../tasks/tasks.service';
import { PublicCreateCommentDto } from './dto/public-comment-input';
import { PublicComment, toPublicComment } from './dto/public-comment';

/**
 * 公開API: タスクのコメント。
 * - 一覧: 閲覧権があれば取得できる（投稿の古い順）
 * - 投稿: 投稿者は API キーの持ち主本人（そのプロジェクトでのメンバー）に固定し、なりすましを防ぐ。
 *   内部のコメント投稿処理を経由するため、@メンション通知もそのまま効く。
 */
@Controller('v1/projects/:key/tasks/:seq/comments')
@UseGuards(ApiKeyGuard, ProjectAccessGuard)
export class PublicCommentsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly tasks: TasksService,
    private readonly members: MembersService,
    private readonly comments: CommentsService,
  ) {}

  /** タスクのコメント一覧（投稿の古い順）。閲覧権があればメンバーでなくても取得できる */
  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Param('seq', ParseIntPipe) seq: number,
  ): Promise<PublicComment[]> {
    const project = await this.projects.findByKeyInTenant(user.tenantId, key);
    const task = await this.tasks.findBySeqInProject(user.tenantId, project.id, seq);
    const comments = await this.comments.listByTask(user.tenantId, project.id, task.id);
    return comments.map(toPublicComment);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Param('seq', ParseIntPipe) seq: number,
    @Body() dto: PublicCreateCommentDto,
  ): Promise<PublicComment> {
    const project = await this.projects.findByKeyInTenant(user.tenantId, key);
    const task = await this.tasks.findBySeqInProject(user.tenantId, project.id, seq);
    // 書き込みは ProjectAccessGuard がメンバーのみに絞っているが、念のため明示的に確認する
    const own = await this.members.findOwnInProject(project.id, user.userId);
    if (!own) {
      throw new ForbiddenException('このプロジェクトのメンバーではないためコメントできません');
    }
    const created = await this.comments.create(
      user.tenantId,
      project.id,
      task.id,
      { authorMemberId: own.id, body: dto.body },
      user.userId,
    );
    return toPublicComment(created);
  }
}
