import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { generateMasterCode } from './ordered-master.helpers';
import { Tag } from './tag.entity';

@Injectable()
export class TagsService {
  constructor(
    @InjectRepository(Tag)
    private readonly tags: Repository<Tag>,
    private readonly projects: ProjectsService,
  ) {}

  async listByProject(tenantId: string, projectId: string): Promise<Tag[]> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    return this.tags.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    });
  }

  async create(tenantId: string, projectId: string, dto: CreateTagDto): Promise<Tag> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const tag = this.tags.create({
      projectId,
      code: generateMasterCode('t'),
      name: dto.name.trim(),
      color: dto.color,
    });
    return this.tags.save(tag);
  }

  async update(tenantId: string, projectId: string, code: string, dto: UpdateTagDto): Promise<Tag> {
    const tag = await this.findInProject(tenantId, projectId, code);
    if (dto.name !== undefined) tag.name = dto.name.trim();
    if (dto.color !== undefined) tag.color = dto.color;
    return this.tags.save(tag);
  }

  async remove(tenantId: string, projectId: string, code: string): Promise<void> {
    const tag = await this.findInProject(tenantId, projectId, code);
    try {
      await this.tags.remove(tag);
    } catch (e) {
      if (this.isFkViolation(e)) {
        throw new ConflictException('参照されているため削除できません');
      }
      throw e;
    }
  }

  private async findInProject(tenantId: string, projectId: string, code: string): Promise<Tag> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const tag = await this.tags.findOne({ where: { projectId, code } });
    if (!tag) throw new NotFoundException('タグが見つかりません');
    return tag;
  }

  private isFkViolation(e: unknown): boolean {
    return (
      e instanceof QueryFailedError &&
      (e as QueryFailedError & { driverError?: { code?: string } }).driverError?.code ===
        'ER_ROW_IS_REFERENCED_2'
    );
  }
}
