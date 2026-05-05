import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tag } from '../masters/tag.entity';
import { ProjectsService } from '../projects/projects.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskTag } from './task-tag.entity';
import { Task, TaskLink } from './task.entity';

/**
 * フロント返却用の Task DTO 形（id 含む、tag は code 配列）。
 */
export interface TaskResponse {
  id: string;
  projectId: string;
  seq: number;
  content: string;
  description: string;
  links: TaskLink[];
  statusCode: string;
  priorityCode: string | null;
  assigneeMemberId: string | null;
  requesterMemberId: string | null;
  requestingDeptCode: string | null;
  deadline: string | null;
  plannedCompletionDate: string | null;
  tagCodes: string[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    @InjectRepository(TaskTag)
    private readonly taskTags: Repository<TaskTag>,
    @InjectRepository(Tag)
    private readonly tags: Repository<Tag>,
    private readonly projects: ProjectsService,
  ) {}

  async listByProject(
    tenantId: string,
    projectId: string,
    filter: TaskFilterDto = {},
  ): Promise<TaskResponse[]> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const tasks = await this.queryBuilder(projectId, filter)
      .orderBy('t.created_at', 'ASC')
      .getMany();
    return this.attachTagCodes(tasks);
  }

  async count(
    tenantId: string,
    projectId: string,
    filter: TaskFilterDto = {},
  ): Promise<number> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    return this.queryBuilder(projectId, filter).getCount();
  }

  async findInProject(
    tenantId: string,
    projectId: string,
    id: string,
  ): Promise<TaskResponse> {
    const task = await this.findEntityInProject(tenantId, projectId, id);
    const [withTags] = await this.attachTagCodes([task]);
    return withTags;
  }

  async create(
    tenantId: string,
    projectId: string,
    dto: CreateTaskDto,
  ): Promise<TaskResponse> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const seq = await this.nextSeq(projectId);
    const task = this.tasks.create({
      projectId,
      seq,
      content: dto.content.trim(),
      description: dto.description ?? '',
      links: dto.links ?? [],
      statusCode: dto.statusCode,
      priorityCode: dto.priorityCode ?? null,
      assigneeMemberId: dto.assigneeMemberId ?? null,
      requesterMemberId: dto.requesterMemberId ?? null,
      requestingDeptCode: dto.requestingDeptCode ?? null,
      deadline: dto.deadline ?? null,
      plannedCompletionDate: dto.plannedCompletionDate ?? null,
    });
    const saved = await this.tasks.save(task);
    if (dto.tagCodes && dto.tagCodes.length > 0) {
      await this.replaceTaskTags(projectId, saved.id, dto.tagCodes);
    }
    return this.findInProject(tenantId, projectId, saved.id);
  }

  async update(
    tenantId: string,
    projectId: string,
    id: string,
    dto: UpdateTaskDto,
  ): Promise<TaskResponse> {
    const task = await this.findEntityInProject(tenantId, projectId, id);
    if (dto.content !== undefined) task.content = dto.content.trim();
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.links !== undefined) task.links = dto.links;
    if (dto.statusCode !== undefined) task.statusCode = dto.statusCode;
    if (dto.priorityCode !== undefined) task.priorityCode = dto.priorityCode ?? null;
    if (dto.assigneeMemberId !== undefined) task.assigneeMemberId = dto.assigneeMemberId ?? null;
    if (dto.requesterMemberId !== undefined) task.requesterMemberId = dto.requesterMemberId ?? null;
    if (dto.requestingDeptCode !== undefined) {
      task.requestingDeptCode = dto.requestingDeptCode ?? null;
    }
    if (dto.deadline !== undefined) task.deadline = dto.deadline ?? null;
    if (dto.plannedCompletionDate !== undefined) {
      task.plannedCompletionDate = dto.plannedCompletionDate ?? null;
    }
    await this.tasks.save(task);
    if (dto.tagCodes !== undefined) {
      await this.replaceTaskTags(projectId, task.id, dto.tagCodes);
    }
    return this.findInProject(tenantId, projectId, task.id);
  }

  async remove(tenantId: string, projectId: string, id: string): Promise<void> {
    const task = await this.findEntityInProject(tenantId, projectId, id);
    await this.tasks.remove(task);
  }

  // ===== 内部ヘルパ =====

  private async findEntityInProject(
    tenantId: string,
    projectId: string,
    id: string,
  ): Promise<Task> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const task = await this.tasks.findOne({ where: { projectId, id } });
    if (!task) throw new NotFoundException('タスクが見つかりません');
    return task;
  }

  private async nextSeq(projectId: string): Promise<number> {
    const row = await this.tasks
      .createQueryBuilder('t')
      .select('MAX(t.seq)', 'maxSeq')
      .where('t.project_id = :projectId', { projectId })
      .getRawOne<{ maxSeq: number | null }>();
    return (row?.maxSeq ?? 0) + 1;
  }

  /**
   * tag_codes 配列に従って task_tags を全置換。
   * 不正な tagCode（同プロジェクト内に存在しない）は黙って無視。
   */
  private async replaceTaskTags(
    projectId: string,
    taskId: string,
    tagCodes: string[],
  ): Promise<void> {
    await this.taskTags.manager.transaction(async (em) => {
      const tagsRepo = em.getRepository(Tag);
      const tagsInProject = await tagsRepo.find({
        where: { projectId, code: In(tagCodes) },
      });
      const ttRepo = em.getRepository(TaskTag);
      await ttRepo.delete({ taskId });
      if (tagsInProject.length === 0) return;
      const rows = tagsInProject.map((t) =>
        ttRepo.create({ taskId, tagId: t.id }),
      );
      await ttRepo.save(rows);
    });
  }

  private async attachTagCodes(tasks: Task[]): Promise<TaskResponse[]> {
    if (tasks.length === 0) return [];
    const ids = tasks.map((t) => t.id);
    const rows = await this.taskTags
      .createQueryBuilder('tt')
      .innerJoin(Tag, 'tag', 'tag.id = tt.tag_id')
      .select(['tt.task_id AS taskId', 'tag.code AS code'])
      .where('tt.task_id IN (:...ids)', { ids })
      .getRawMany<{ taskId: string; code: string }>();
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const arr = map.get(r.taskId) ?? [];
      arr.push(r.code);
      map.set(r.taskId, arr);
    }
    return tasks.map((t) => this.toResponse(t, map.get(t.id) ?? []));
  }

  private toResponse(t: Task, tagCodes: string[]): TaskResponse {
    return {
      id: t.id,
      projectId: t.projectId,
      seq: t.seq,
      content: t.content,
      description: t.description,
      links: t.links,
      statusCode: t.statusCode,
      priorityCode: t.priorityCode,
      assigneeMemberId: t.assigneeMemberId,
      requesterMemberId: t.requesterMemberId,
      requestingDeptCode: t.requestingDeptCode,
      deadline: t.deadline,
      plannedCompletionDate: t.plannedCompletionDate,
      tagCodes,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  private queryBuilder(projectId: string, filter: TaskFilterDto) {
    const qb = this.tasks.createQueryBuilder('t').where('t.project_id = :projectId', { projectId });
    if (filter.statusCode) qb.andWhere('t.status_code = :s', { s: filter.statusCode });
    if (filter.priorityCode) qb.andWhere('t.priority_code = :p', { p: filter.priorityCode });
    if (filter.assigneeMemberId) {
      qb.andWhere('t.assignee_member_id = :a', { a: filter.assigneeMemberId });
    }
    if (filter.requesterMemberId) {
      qb.andWhere('t.requester_member_id = :r', { r: filter.requesterMemberId });
    }
    if (filter.requestingDeptCode) {
      qb.andWhere('t.requesting_dept_code = :d', { d: filter.requestingDeptCode });
    }
    if (filter.tagCode) {
      qb.andWhere(
        `t.id IN (
          SELECT tt.task_id FROM task_tags tt
          INNER JOIN tags g ON g.id = tt.tag_id AND g.project_id = :projectId
          WHERE g.code = :tagCode
        )`,
        { projectId, tagCode: filter.tagCode },
      );
    }
    return qb;
  }
}
