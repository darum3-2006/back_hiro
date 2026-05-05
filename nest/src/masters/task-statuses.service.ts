import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { CreateTaskStatusDto } from './dto/create-task-status.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import {
  generateMasterCode,
  nextOrder,
  reorderByCodes,
  swapWithNeighbour,
} from './ordered-master.helpers';
import { TaskStatus } from './task-status.entity';

@Injectable()
export class TaskStatusesService {
  constructor(
    @InjectRepository(TaskStatus)
    private readonly statuses: Repository<TaskStatus>,
    private readonly projects: ProjectsService,
  ) {}

  async listByProject(tenantId: string, projectId: string): Promise<TaskStatus[]> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    return this.statuses.find({
      where: { projectId },
      order: { order: 'ASC' },
    });
  }

  async create(
    tenantId: string,
    projectId: string,
    dto: CreateTaskStatusDto,
  ): Promise<TaskStatus> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const status = this.statuses.create({
      projectId,
      code: generateMasterCode('s'),
      label: dto.label.trim(),
      color: dto.color,
      isTerminal: dto.isTerminal,
      order: await nextOrder(this.statuses, projectId),
    });
    return this.statuses.save(status);
  }

  async update(
    tenantId: string,
    projectId: string,
    code: string,
    dto: UpdateTaskStatusDto,
  ): Promise<TaskStatus> {
    const status = await this.findInProject(tenantId, projectId, code);
    if (dto.label !== undefined) status.label = dto.label.trim();
    if (dto.color !== undefined) status.color = dto.color;
    if (dto.isTerminal !== undefined) status.isTerminal = dto.isTerminal;
    return this.statuses.save(status);
  }

  async remove(tenantId: string, projectId: string, code: string): Promise<void> {
    const status = await this.findInProject(tenantId, projectId, code);
    try {
      await this.statuses.remove(status);
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
    await swapWithNeighbour(this.statuses, projectId, code, direction);
  }

  async reorder(tenantId: string, projectId: string, orderedCodes: string[]): Promise<void> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    await reorderByCodes(this.statuses, projectId, orderedCodes);
  }

  private async findInProject(
    tenantId: string,
    projectId: string,
    code: string,
  ): Promise<TaskStatus> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const status = await this.statuses.findOne({ where: { projectId, code } });
    if (!status) throw new NotFoundException('ステータスが見つかりません');
    return status;
  }

  private isFkViolation(e: unknown): boolean {
    return (
      e instanceof QueryFailedError &&
      (e as QueryFailedError & { driverError?: { code?: string } }).driverError?.code ===
        'ER_ROW_IS_REFERENCED_2'
    );
  }
}
