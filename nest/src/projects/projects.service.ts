import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectMember } from '../members/member.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(ProjectMember)
    private readonly members: Repository<ProjectMember>,
  ) {}

  /** 当該プロジェクトの管理者か（自分の ProjectMember が role=admin）。テナント admin 判定は呼び出し側で。 */
  async isProjectAdmin(projectId: string, userId: string): Promise<boolean> {
    const own = await this.members.findOne({ where: { projectId, userId } });
    return own?.role === 'admin';
  }

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

  /** 公開API用：プロジェクト key（大文字化して照合）でテナント内のプロジェクトを引く。 */
  async findByKeyInTenant(tenantId: string, key: string): Promise<Project> {
    const project = await this.projects.findOne({
      where: { tenantId, key: key.trim().toUpperCase() },
    });
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
    if (dto.highlightOverdueDeadline !== undefined) {
      project.highlightOverdueDeadline = dto.highlightOverdueDeadline;
    }
    if (dto.highlightOverduePlannedStart !== undefined) {
      project.highlightOverduePlannedStart = dto.highlightOverduePlannedStart;
    }
    if (dto.highlightOverduePlannedCompletion !== undefined) {
      project.highlightOverduePlannedCompletion = dto.highlightOverduePlannedCompletion;
    }
    if (dto.highlightOverduePlannedRelease !== undefined) {
      project.highlightOverduePlannedRelease = dto.highlightOverduePlannedRelease;
    }
    if (dto.slackWebhookUrl !== undefined) {
      // null / 空文字は解除扱い
      project.slackWebhookUrl = dto.slackWebhookUrl?.trim() || null;
    }
    if (dto.slackNotifyTaskCreated !== undefined) {
      project.slackNotifyTaskCreated = dto.slackNotifyTaskCreated;
    }
    if (dto.slackNotifyStatusChanged !== undefined) {
      project.slackNotifyStatusChanged = dto.slackNotifyStatusChanged;
    }
    if (dto.slackNotifyTaskCompleted !== undefined) {
      project.slackNotifyTaskCompleted = dto.slackNotifyTaskCompleted;
    }
    return this.projects.save(project);
  }
}
