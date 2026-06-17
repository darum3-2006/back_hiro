import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { generateShortCode } from '../common/short-code';
import { MembersService } from '../members/members.service';
import { ProjectsService } from '../projects/projects.service';
import { CreateSavedViewDto } from './dto/create-saved-view.dto';
import { UpdateSavedViewDto } from './dto/update-saved-view.dto';
import { SavedView } from './saved-view.entity';

@Injectable()
export class SavedViewsService {
  constructor(
    @InjectRepository(SavedView)
    private readonly savedViews: Repository<SavedView>,
    private readonly projects: ProjectsService,
    private readonly members: MembersService,
  ) {}

  /** プロジェクト内で当該ユーザーが見られるビュー（自分の private ＋ shared 全部）を返す。 */
  async listForUser(
    tenantId: string,
    projectId: string,
    user: AuthenticatedUser,
  ): Promise<SavedView[]> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    return this.savedViews.find({
      where: [
        { projectId, visibility: 'shared' },
        { projectId, ownerUserId: user.userId },
      ],
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async create(
    tenantId: string,
    projectId: string,
    user: AuthenticatedUser,
    dto: CreateSavedViewDto,
  ): Promise<SavedView> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const view = this.savedViews.create({
      projectId,
      ownerUserId: user.userId,
      name: dto.name.trim(),
      visibility: dto.visibility ?? 'private',
      config: dto.config,
      shortCode: await this.nextShortCode(),
    });
    return this.savedViews.save(view);
  }

  /**
   * 短縮コードから共有リンク先のビューを解決する（プロジェクト不要・テナント横断の入口）。
   * 共有ビュー、または自分の private のみ解決可（他人の private は存在を秘して 404）。
   */
  async resolveByCode(
    tenantId: string,
    code: string,
    user: AuthenticatedUser,
  ): Promise<{ projectId: string; viewId: string }> {
    const view = await this.savedViews
      .createQueryBuilder('v')
      .innerJoin('v.project', 'p')
      .where('v.short_code = :code', { code })
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .select(['v.id', 'v.projectId', 'v.visibility', 'v.ownerUserId'])
      .getOne();
    if (!view || !this.canView(view, user)) {
      throw new NotFoundException('ビューが見つかりません');
    }
    return { projectId: view.projectId, viewId: view.id };
  }

  /** 衝突しない短縮コードを生成する（最大 5 回まで再試行）。 */
  private async nextShortCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = generateShortCode();
      const exists = await this.savedViews.findOne({ where: { shortCode: code } });
      if (!exists) return code;
    }
    throw new Error('短縮コードの生成に失敗しました');
  }

  async update(
    tenantId: string,
    projectId: string,
    id: string,
    user: AuthenticatedUser,
    dto: UpdateSavedViewDto,
  ): Promise<SavedView> {
    const view = await this.findVisible(tenantId, projectId, id, user);
    await this.assertCanEdit(tenantId, projectId, view, user);
    if (dto.name !== undefined) view.name = dto.name.trim();
    if (dto.visibility !== undefined) view.visibility = dto.visibility;
    if (dto.config !== undefined) view.config = dto.config;
    return this.savedViews.save(view);
  }

  async remove(
    tenantId: string,
    projectId: string,
    id: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const view = await this.findVisible(tenantId, projectId, id, user);
    await this.assertCanEdit(tenantId, projectId, view, user);
    await this.savedViews.remove(view);
  }

  /** 共有ビューを自分の private ビューとして複製する（他人の shared ビューを使う経路）。 */
  async duplicate(
    tenantId: string,
    projectId: string,
    id: string,
    user: AuthenticatedUser,
  ): Promise<SavedView> {
    const source = await this.findVisible(tenantId, projectId, id, user);
    const copy = this.savedViews.create({
      projectId,
      ownerUserId: user.userId,
      name: `${source.name} のコピー`.slice(0, 100),
      visibility: 'private',
      config: source.config,
    });
    return this.savedViews.save(copy);
  }

  /** プロジェクト内かつ当該ユーザーが閲覧可能なビューを取得する。見えない場合は存在を秘して 404。 */
  private async findVisible(
    tenantId: string,
    projectId: string,
    id: string,
    user: AuthenticatedUser,
  ): Promise<SavedView> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const view = await this.savedViews.findOne({ where: { projectId, id } });
    if (!view || !this.canView(view, user)) {
      throw new NotFoundException('ビューが見つかりません');
    }
    return view;
  }

  /** 自分の private、または shared なら閲覧可。 */
  private canView(view: SavedView, user: AuthenticatedUser): boolean {
    return view.visibility === 'shared' || view.ownerUserId === user.userId;
  }

  /**
   * 編集/削除の可否を判定する。
   * - 作成者本人は常に可
   * - 作成者が削除済み（owner=NULL）かつ shared な孤児ビューは ProjectMember admin が引き取り可
   * - それ以外（他人のビュー）は不可
   */
  private async assertCanEdit(
    tenantId: string,
    projectId: string,
    view: SavedView,
    user: AuthenticatedUser,
  ): Promise<void> {
    if (view.ownerUserId === user.userId) return;
    if (view.ownerUserId === null && view.visibility === 'shared') {
      await this.members.assertProjectAdmin(tenantId, projectId, user);
      return;
    }
    throw new ForbiddenException('このビューを編集する権限がありません');
  }
}
