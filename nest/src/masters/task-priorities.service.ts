import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { CreateTaskPriorityDto } from './dto/create-task-priority.dto';
import { UpdateTaskPriorityDto } from './dto/update-task-priority.dto';
import {
  generateMasterCode,
  nextOrder,
  reorderByCodes,
  swapWithNeighbour,
} from './ordered-master.helpers';
import { TaskPriority } from './task-priority.entity';

@Injectable()
export class TaskPrioritiesService {
  constructor(
    @InjectRepository(TaskPriority)
    private readonly priorities: Repository<TaskPriority>,
    private readonly projects: ProjectsService,
  ) {}

  async listByProject(tenantId: string, projectId: string): Promise<TaskPriority[]> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    return this.priorities.find({
      where: { projectId },
      order: { order: 'ASC' },
    });
  }

  async create(
    tenantId: string,
    projectId: string,
    dto: CreateTaskPriorityDto,
  ): Promise<TaskPriority> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const priority = this.priorities.create({
      projectId,
      code: generateMasterCode('p'),
      label: dto.label.trim(),
      color: dto.color,
      order: await nextOrder(this.priorities, projectId),
    });
    return this.priorities.save(priority);
  }

  async update(
    tenantId: string,
    projectId: string,
    code: string,
    dto: UpdateTaskPriorityDto,
  ): Promise<TaskPriority> {
    const priority = await this.findInProject(tenantId, projectId, code);
    if (dto.label !== undefined) priority.label = dto.label.trim();
    if (dto.color !== undefined) priority.color = dto.color;
    return this.priorities.save(priority);
  }

  async remove(tenantId: string, projectId: string, code: string): Promise<void> {
    const priority = await this.findInProject(tenantId, projectId, code);
    try {
      await this.priorities.remove(priority);
    } catch (e) {
      if (this.isFkViolation(e)) {
        throw new ConflictException('参照されているため削除できません');
      }
      throw e;
    }
  }

  async move(
    tenantId: string,
    projectId: string,
    code: string,
    direction: 'up' | 'down',
  ): Promise<void> {
    await this.findInProject(tenantId, projectId, code);
    await swapWithNeighbour(this.priorities, projectId, code, direction);
  }

  async reorder(tenantId: string, projectId: string, orderedCodes: string[]): Promise<void> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    await reorderByCodes(this.priorities, projectId, orderedCodes);
  }

  private async findInProject(
    tenantId: string,
    projectId: string,
    code: string,
  ): Promise<TaskPriority> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const priority = await this.priorities.findOne({ where: { projectId, code } });
    if (!priority) throw new NotFoundException('優先度が見つかりません');
    return priority;
  }

  private isFkViolation(e: unknown): boolean {
    return (
      e instanceof QueryFailedError &&
      (e as QueryFailedError & { driverError?: { code?: string } }).driverError?.code ===
        'ER_ROW_IS_REFERENCED_2'
    );
  }
}
