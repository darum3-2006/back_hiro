import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectsService } from '../projects/projects.service';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import type { UserRole } from '../users/user.entity';
import { ProjectMember, type MemberRole } from './member.entity';

/** メンバー一覧のレスポンス。紐づくユーザーのロールを userRole として持つ（未紐付けは null） */
export interface MemberWithUserRole {
  id: string;
  projectId: string;
  userId: string | null;
  displayName: string;
  role: MemberRole;
  userRole: UserRole | null;
}

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

  /**
   * メンバー一覧 + 紐づくユーザーのロール。
   * フロントが担当者ピッカーから readonly（閲覧のみ）ユーザーを除外するために使う。
   * User エンティティをそのまま返すと passwordHash 等が漏れるため、必要な項目だけに整形する。
   */
  async listByProjectWithUserRole(
    tenantId: string,
    projectId: string,
  ): Promise<MemberWithUserRole[]> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const members = await this.members.find({
      where: { projectId },
      relations: { user: true },
      order: { createdAt: 'ASC' },
    });
    return members.map((m) => ({
      id: m.id,
      projectId: m.projectId,
      userId: m.userId,
      displayName: m.displayName,
      role: m.role,
      userRole: m.user?.role ?? null,
    }));
  }

  /**
   * プロジェクトメンバーの管理操作を許可してよいかチェックする。
   * - テナント admin（User.role=admin）は常に許可（締め出し防止のエスケープハッチ）
   * - それ以外は、当該プロジェクトに自分の ProjectMember があり role=admin のときだけ許可
   */
  async assertProjectAdmin(
    tenantId: string,
    projectId: string,
    actingUser: AuthenticatedUser,
  ): Promise<void> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    if (actingUser.role === 'admin') return;
    const own = await this.members.findOne({
      where: { projectId, userId: actingUser.userId },
    });
    if (!own || own.role !== 'admin') {
      throw new ForbiddenException(
        'プロジェクトメンバーの管理はプロジェクト管理者のみ実行できます',
      );
    }
  }

  async create(tenantId: string, projectId: string, dto: CreateMemberDto): Promise<ProjectMember> {
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

  /**
   * 表示名を複数まとめて追加する（User 紐付けは全て無し・権限は一括指定）。
   * 空白行は除外。userId=null なので一意制約（projectId, userId）には当たらない。
   */
  async bulkCreate(
    tenantId: string,
    projectId: string,
    displayNames: string[],
    role: MemberRole,
  ): Promise<ProjectMember[]> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const names = displayNames.map((n) => n.trim()).filter((n) => n.length > 0);
    if (names.length === 0) {
      throw new BadRequestException('表示名を 1 件以上入力してください');
    }
    const entities = names.map((displayName) =>
      this.members.create({ projectId, userId: null, displayName, role }),
    );
    return this.members.save(entities);
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
