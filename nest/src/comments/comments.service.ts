import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectMember } from '../members/member.entity';
import { ProjectsService } from '../projects/projects.service';
import { Task } from '../tasks/task.entity';
import { Comment } from './comment.entity';
import { CommentFilterDto } from './dto/comment-filter.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly comments: Repository<Comment>,
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    @InjectRepository(ProjectMember)
    private readonly members: Repository<ProjectMember>,
    private readonly projects: ProjectsService,
  ) {}

  async listByTask(tenantId: string, projectId: string, taskId: string): Promise<Comment[]> {
    await this.assertTaskInProject(tenantId, projectId, taskId);
    return this.comments.find({
      where: { taskId },
      order: { createdAt: 'ASC' },
    });
  }

  async count(tenantId: string, projectId: string, filter: CommentFilterDto = {}): Promise<number> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const qb = this.comments
      .createQueryBuilder('c')
      .where('c.project_id = :projectId', { projectId });
    if (filter.taskId) qb.andWhere('c.task_id = :taskId', { taskId: filter.taskId });
    if (filter.authorMemberId) {
      qb.andWhere('c.author_member_id = :authorMemberId', {
        authorMemberId: filter.authorMemberId,
      });
    }
    return qb.getCount();
  }

  async create(
    tenantId: string,
    projectId: string,
    taskId: string,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    await this.assertTaskInProject(tenantId, projectId, taskId);
    await this.assertMemberInProject(projectId, dto.authorMemberId);
    const comment = this.comments.create({
      projectId,
      taskId,
      authorMemberId: dto.authorMemberId,
      body: dto.body,
    });
    return this.comments.save(comment);
  }

  async update(
    tenantId: string,
    projectId: string,
    taskId: string,
    id: string,
    dto: UpdateCommentDto,
  ): Promise<Comment> {
    const comment = await this.findInTask(tenantId, projectId, taskId, id);
    comment.body = dto.body;
    return this.comments.save(comment);
  }

  async remove(tenantId: string, projectId: string, taskId: string, id: string): Promise<void> {
    const comment = await this.findInTask(tenantId, projectId, taskId, id);
    await this.comments.remove(comment);
  }

  // ===== 内部ヘルパ =====

  private async assertTaskInProject(
    tenantId: string,
    projectId: string,
    taskId: string,
  ): Promise<void> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const task = await this.tasks.findOne({ where: { projectId, id: taskId } });
    if (!task) throw new NotFoundException('タスクが見つかりません');
  }

  private async assertMemberInProject(projectId: string, memberId: string): Promise<void> {
    const member = await this.members.findOne({ where: { projectId, id: memberId } });
    if (!member) {
      throw new BadRequestException('指定されたメンバーはこのプロジェクトに存在しません');
    }
  }

  private async findInTask(
    tenantId: string,
    projectId: string,
    taskId: string,
    id: string,
  ): Promise<Comment> {
    await this.assertTaskInProject(tenantId, projectId, taskId);
    const comment = await this.comments.findOne({ where: { taskId, id } });
    if (!comment) throw new NotFoundException('コメントが見つかりません');
    return comment;
  }
}
