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
import { CommentsService } from './comments.service';
import { CommentFilterDto } from './dto/comment-filter.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Controller()
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('projects/:projectId/tasks/:taskId/comments')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.comments.listByTask(user.tenantId, projectId, taskId);
  }

  @Get('projects/:projectId/comments/count')
  async count(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Query() filter: CommentFilterDto,
  ) {
    return { count: await this.comments.count(user.tenantId, projectId, filter) };
  }

  @Post('projects/:projectId/tasks/:taskId/comments')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(user.tenantId, projectId, taskId, dto, user.userId);
  }

  @Patch('projects/:projectId/tasks/:taskId/comments/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.comments.update(user.tenantId, projectId, taskId, id, dto);
  }

  @Delete('projects/:projectId/tasks/:taskId/comments/:id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.comments.remove(user.tenantId, projectId, taskId, id);
  }
}
