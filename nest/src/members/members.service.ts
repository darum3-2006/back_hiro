import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { ProjectMember } from './member.entity';

@Injectable()
export class MembersService {
  constructor(
    @InjectRepository(ProjectMember)
    private readonly members: Repository<ProjectMember>,
    private readonly projects: ProjectsService,
  ) {}

  async listByProject(tenantId: string, projectId: string): Promise<ProjectMember[]> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    return this.members.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    });
  }

  async create(
    tenantId: string,
    projectId: string,
    dto: CreateMemberDto,
  ): Promise<ProjectMember> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const member = this.members.create({
      projectId,
      userId: dto.userId ?? null,
      displayName: dto.displayName.trim(),
      role: dto.role,
    });
    try {
      return await this.members.save(member);
    } catch (e) {
      if (this.isDuplicateKey(e)) {
        throw new ConflictException('このユーザーは既にメンバーに追加されています');
      }
      throw e;
    }
  }

  async update(
    tenantId: string,
    projectId: string,
    id: string,
    dto: UpdateMemberDto,
  ): Promise<ProjectMember> {
    const member = await this.findByIdInProject(tenantId, projectId, id);
    if (dto.displayName !== undefined) member.displayName = dto.displayName.trim();
    if (dto.userId !== undefined) member.userId = dto.userId ?? null;
    if (dto.role !== undefined) member.role = dto.role;
    try {
      return await this.members.save(member);
    } catch (e) {
      if (this.isDuplicateKey(e)) {
        throw new ConflictException('このユーザーは既にメンバーに追加されています');
      }
      throw e;
    }
  }

  async remove(tenantId: string, projectId: string, id: string): Promise<void> {
    const member = await this.findByIdInProject(tenantId, projectId, id);
    await this.members.remove(member);
  }

  private async findByIdInProject(
    tenantId: string,
    projectId: string,
    id: string,
  ): Promise<ProjectMember> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const member = await this.members.findOne({ where: { projectId, id } });
    if (!member) throw new NotFoundException('メンバーが見つかりません');
    return member;
  }

  private isDuplicateKey(e: unknown): boolean {
    return (
      e instanceof QueryFailedError &&
      (e as QueryFailedError & { driverError?: { code?: string } }).driverError?.code ===
        'ER_DUP_ENTRY'
    );
  }
}
