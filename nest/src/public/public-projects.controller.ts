import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectsService } from '../projects/projects.service';
import { PublicCreateProjectDto, PublicUpdateProjectDto } from './dto/public-project-input';
import { PublicProject, toPublicProject } from './dto/public-project';

/**
 * 公開API: プロジェクト（APIキー所有ユーザーのテナントにスコープ）。
 * - 読み取り: 一覧（アーカイブ済みは除外）
 * - 書き込み: 作成 / 部分更新（name・description のみ）/ アーカイブ・復元（admin のみ）
 * DELETE は提供しない（削除の代わりにアーカイブを使う）。
 */
@Controller('v1/projects')
@UseGuards(ApiKeyGuard)
export class PublicProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<PublicProject[]> {
    const projects = await this.projects.listByTenant(user.tenantId);
    return projects.filter((p) => p.archivedAt === null).map(toPublicProject);
  }

  /** プロジェクト作成。key 重複は 409。 */
  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: PublicCreateProjectDto,
  ): Promise<PublicProject> {
    const created = await this.projects.create(user.tenantId, dto);
    return toPublicProject(created);
  }

  /** 部分更新（PATCH）。公開APIから書けるのは name / description のみ。 */
  @Patch(':key')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
    @Body() dto: PublicUpdateProjectDto,
  ): Promise<PublicProject> {
    const project = await this.projects.findByKeyInTenant(user.tenantId, key);
    const updated = await this.projects.update(user.tenantId, project.id, {
      name: dto.name,
      description: dto.description,
    });
    return toPublicProject(updated);
  }

  /** アーカイブ（admin のみ）。アーカイブ済みなら何もせず 200（冪等）。 */
  @Post(':key/archive')
  @HttpCode(200)
  async archive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
  ): Promise<PublicProject> {
    this.assertAdmin(user);
    const project = await this.projects.findByKeyInTenant(user.tenantId, key);
    if (project.archivedAt !== null) return toPublicProject(project);
    const updated = await this.projects.update(user.tenantId, project.id, { archived: true });
    return toPublicProject(updated);
  }

  /** アーカイブ解除（admin のみ）。非アーカイブなら何もせず 200（冪等）。 */
  @Post(':key/unarchive')
  @HttpCode(200)
  async unarchive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('key') key: string,
  ): Promise<PublicProject> {
    this.assertAdmin(user);
    const project = await this.projects.findByKeyInTenant(user.tenantId, key);
    if (project.archivedAt === null) return toPublicProject(project);
    const updated = await this.projects.update(user.tenantId, project.id, { archived: false });
    return toPublicProject(updated);
  }

  /** アーカイブ/復元は内部と同じくテナント admin のみ（キー所有ユーザーの role で判定）。 */
  private assertAdmin(user: AuthenticatedUser): void {
    if (user.role !== 'admin') {
      throw new ForbiddenException(
        'プロジェクトのアーカイブ/復元は admin のAPIキーのみ実行できます',
      );
    }
  }
}
