import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
  ) {}

  listByTenant(tenantId: string): Promise<Project[]> {
    return this.projects.find({
      where: { tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  async findByIdInTenant(tenantId: string, id: string): Promise<Project> {
    const project = await this.projects.findOne({ where: { tenantId, id } });
    if (!project) throw new NotFoundException('プロジェクトが見つかりません');
    return project;
  }

  async create(tenantId: string, dto: CreateProjectDto): Promise<Project> {
    const key = dto.key.trim().toUpperCase();
    const existing = await this.projects.findOne({ where: { tenantId, key } });
    if (existing) {
      throw new ConflictException(`プロジェクトキー「${key}」は既に使われています`);
    }
    const project = this.projects.create({
      tenantId,
      key,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      archivedAt: null,
    });
    return this.projects.save(project);
  }

  async update(tenantId: string, id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.findByIdInTenant(tenantId, id);
    if (dto.name !== undefined) project.name = dto.name.trim();
    if (dto.description !== undefined) {
      project.description = dto.description?.trim() || null;
    }
    if (dto.archived !== undefined) {
      project.archivedAt = dto.archived ? new Date() : null;
    }
    return this.projects.save(project);
  }
}
