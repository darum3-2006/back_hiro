import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import type { UserRole } from '../users/user.entity';
import { Project } from './project.entity';
import { UserProjectAccess } from './user-project-access.entity';

/** テナント admin は設定に関係なく全プロジェクトを閲覧できる */
const isUnrestricted = (role: UserRole): boolean => role === 'admin';

/**
 * プロジェクトの閲覧可否（`user_project_access`）を一手に引き受けるサービス。
 *
 * 判定をここ 1 か所に集約しているため、内部 API（JWT）と公開API（APIキー）で
 * 同じルールが効く。`ProjectAccessGuard` と横断エンドポイントの絞り込みが利用者。
 */
@Injectable()
export class ProjectAccessService {
  constructor(
    @InjectRepository(UserProjectAccess)
    private readonly access: Repository<UserProjectAccess>,
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
  ) {}

  /**
   * このユーザーが閲覧できるプロジェクト ID。
   * `null` は「制限なし（admin）」を意味し、呼び出し側は絞り込みを行わない。
   */
  async accessibleProjectIds(user: AuthenticatedUser): Promise<string[] | null> {
    if (isUnrestricted(user.role)) return null;
    return this.listProjectIds(user.tenantId, user.userId);
  }

  /** 設定されているプロジェクト ID。admin でも設定行そのものを返す（設定画面用） */
  async listProjectIds(tenantId: string, userId: string): Promise<string[]> {
    const rows = await this.access.find({
      where: { tenantId, userId },
      select: { projectId: true },
    });
    return rows.map((r) => r.projectId);
  }

  /** テナント全ユーザーの設定をまとめて引く（ユーザー一覧の表示用） */
  async listProjectIdsByUser(tenantId: string): Promise<Map<string, string[]>> {
    const rows = await this.access.find({
      where: { tenantId },
      select: { userId: true, projectId: true },
    });
    const byUser = new Map<string, string[]>();
    for (const row of rows) {
      const list = byUser.get(row.userId);
      if (list) list.push(row.projectId);
      else byUser.set(row.userId, [row.projectId]);
    }
    return byUser;
  }

  /**
   * 指定ユーザーのうち、このプロジェクトの閲覧を許可されている ID を返す。
   * admin は設定行を持たなくても閲覧できるため、ここには現れない（呼び出し側でロールを見る）。
   */
  async listUserIdsForProject(
    tenantId: string,
    projectId: string,
    userIds: string[],
  ): Promise<string[]> {
    if (userIds.length === 0) return [];
    const rows = await this.access.find({
      where: { tenantId, projectId, userId: In([...new Set(userIds)]) },
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }

  async canAccess(user: AuthenticatedUser, projectId: string): Promise<boolean> {
    if (isUnrestricted(user.role)) return true;
    const count = await this.access.countBy({
      tenantId: user.tenantId,
      userId: user.userId,
      projectId,
    });
    return count > 0;
  }

  /**
   * 閲覧権がなければ 404 を投げる。
   * 403 ではなく 404 にするのは、見えないプロジェクトの存在自体を伏せるため。
   */
  async assertAccess(user: AuthenticatedUser, projectId: string): Promise<void> {
    if (await this.canAccess(user, projectId)) return;
    throw new NotFoundException('プロジェクトが見つかりません');
  }

  /**
   * 公開API 用。プロジェクト key から解決して判定する。
   * key が存在しない場合は各コントローラの `findByKeyInTenant` が 404 を出すので、ここでは通す。
   */
  async assertAccessByKey(user: AuthenticatedUser, key: string): Promise<void> {
    if (isUnrestricted(user.role)) return;
    const project = await this.projects.findOne({
      where: { tenantId: user.tenantId, key: key.trim().toUpperCase() },
      select: { id: true },
    });
    if (!project) return;
    await this.assertAccess(user, project.id);
  }

  /**
   * 閲覧権を 1 件付与する（冪等）。
   * 明示付与運用のため、プロジェクト作成時に作成者だけへ自動付与する用途で使う。
   */
  async grant(tenantId: string, userId: string, projectId: string): Promise<void> {
    const existing = await this.access.countBy({ tenantId, userId, projectId });
    if (existing > 0) return;
    await this.access.save(this.access.create({ tenantId, userId, projectId }));
  }

  /**
   * 指定 ID がすべてこのテナントのプロジェクトであることを確認する（違えば 400）。
   * 他テナントのプロジェクト ID を混ぜられないようにするための検証。
   */
  async assertProjectsInTenant(tenantId: string, projectIds: string[]): Promise<void> {
    const wanted = [...new Set(projectIds)];
    if (wanted.length === 0) return;
    const found = await this.projects.countBy({ tenantId, id: In(wanted) });
    if (found !== wanted.length) {
      throw new BadRequestException('存在しないプロジェクトが含まれています');
    }
  }

  /**
   * ユーザーの設定を丸ごと置き換える（設定画面からの保存）。
   * 差分だけ反映して、変更のない行の created_at を保つ。
   */
  async replaceForUser(tenantId: string, userId: string, projectIds: string[]): Promise<void> {
    const wanted = [...new Set(projectIds)];
    await this.assertProjectsInTenant(tenantId, wanted);

    const current = await this.access.find({ where: { tenantId, userId } });
    const removed = current.filter((row) => !wanted.includes(row.projectId));
    const added = wanted.filter((id) => !current.some((row) => row.projectId === id));

    // 論理削除ではなく物理削除する（ユニーク制約と衝突して再付与できなくなるため）
    if (removed.length > 0) await this.access.delete(removed.map((row) => row.id));
    if (added.length > 0) {
      await this.access.save(
        added.map((projectId) => this.access.create({ tenantId, userId, projectId })),
      );
    }
  }
}
