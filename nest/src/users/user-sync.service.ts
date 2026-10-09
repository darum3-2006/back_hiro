import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { ProjectAccessService } from '../projects/project-access.service';
import { UserSyncActionDto, UserSyncExecuteDto, UserSyncPreviewDto } from './dto/sync-users.dto';
import { isUserRole, User, type UserRole } from './user.entity';

/** 厳密な RFC 準拠ではなく「明らかな入力ミス」を弾ければ十分 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type UserSyncItemType = 'create' | 'restore' | 'delete' | 'unchanged' | 'error';

export interface UserSyncPreviewItem {
  type: UserSyncItemType;
  /** Excel の行番号（1 行目をヘッダとして 2 始まり）。delete はファイルに行がないため null */
  row: number | null;
  email: string;
  name: string;
  /** create: 適用予定ロール / restore・delete・unchanged: 現在のロール / error: null */
  role: UserRole | null;
  /** create のみ: 付与予定のプロジェクト（画面選択のデフォルト） */
  projectIds?: string[];
  /** restore / delete / unchanged: 対象ユーザー ID */
  userId?: string;
  warnings: string[];
  /** delete のみ: 値があると保護のため実行対象にできない */
  protectedReason?: string;
}

export interface UserSyncExecuteResultItem {
  type: 'create' | 'restore' | 'delete';
  email: string;
  name: string;
  status: 'applied' | 'skipped';
  reason?: string;
}

export interface UserSyncExecuteResult {
  applied: { create: number; restore: number; delete: number };
  skipped: number;
  items: UserSyncExecuteResultItem[];
}

/**
 * Excel からのユーザー同期（プレビュー / 実行）。設計は docs/USER_EXCEL_SYNC.md。
 *
 * - 同期キーはメールアドレス（trim + 小文字化）
 * - 既存ユーザーの氏名・ロールは上書きしない（差分タイプに「更新」はない）
 * - 復活は deleted_at を NULL に戻すだけ（削除前の状態を完全維持）
 * - 実行は行単位で独立（部分成功を許容し、スキップは理由つきで結果に返す）
 */
@Injectable()
export class UserSyncService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly access: ProjectAccessService,
  ) {}

  async preview(
    tenantId: string,
    actingUserId: string,
    dto: UserSyncPreviewDto,
  ): Promise<{ items: UserSyncPreviewItem[] }> {
    await this.access.assertProjectsInTenant(tenantId, dto.projectIds ?? []);

    const all = await this.users.find({
      where: { tenantId },
      withDeleted: true,
      order: { createdAt: 'ASC' },
    });
    const byEmail = new Map(all.map((u) => [u.email, u]));

    const items: UserSyncPreviewItem[] = [];
    // ファイル内重複の検出用（正常行のみ登録し、2 行目以降をエラーにする）
    const firstRowByEmail = new Map<string, number>();
    // 「ファイルに載っている」メールアドレス。エラー行も（メールが読める限り）含めて
    // 在籍扱いにし、行が壊れているだけのユーザーを削除対象にしない
    const presentEmails = new Set<string>();

    dto.rows.forEach((raw, i) => {
      const rowNo = i + 2;
      const email = raw.email.trim().toLowerCase();
      const name = raw.name.trim();
      const roleRaw = (raw.role ?? '').trim().toLowerCase();

      const errors: string[] = [];
      const emailValid = email.length <= 255 && EMAIL_RE.test(email);
      if (!emailValid) errors.push('メールアドレスの形式が不正です');
      if (!name) errors.push('氏名が空欄です');
      else if (name.length > 100) errors.push('氏名が長すぎます（100 文字まで）');
      const dupRow = emailValid ? firstRowByEmail.get(email) : undefined;
      if (dupRow !== undefined) errors.push(`${dupRow} 行目とメールアドレスが重複しています`);

      if (errors.length > 0) {
        if (emailValid) presentEmails.add(email);
        items.push({ type: 'error', row: rowNo, email, name, role: null, warnings: errors });
        return;
      }

      firstRowByEmail.set(email, rowNo);
      presentEmails.add(email);

      const existing = byEmail.get(email);
      const warnings: string[] = [];
      const fileRole = roleRaw && isUserRole(roleRaw) ? roleRaw : null;

      if (!existing) {
        let role: UserRole = dto.defaultRole;
        if (fileRole) role = fileRole;
        else if (roleRaw) {
          warnings.push(
            `無効なロール値「${(raw.role ?? '').trim()}」のためデフォルトの「${dto.defaultRole}」を適用します`,
          );
        }
        items.push({
          type: 'create',
          row: rowNo,
          email,
          name,
          role,
          projectIds: dto.projectIds ?? [],
          warnings,
        });
        return;
      }

      if (existing.deletedAt) {
        if (fileRole && fileRole !== existing.role) {
          warnings.push(`復活では削除前のロール（${existing.role}）を維持します`);
        }
        items.push({
          type: 'restore',
          row: rowNo,
          email,
          name: existing.name,
          role: existing.role,
          userId: existing.id,
          warnings,
        });
        return;
      }

      // 変更なし。氏名・ロールがファイルと違う場合は「上書きしない」ことを可視化する
      if (name !== existing.name) {
        warnings.push(`氏名が異なりますが上書きしません（現在: ${existing.name}）`);
      }
      if (fileRole && fileRole !== existing.role) {
        warnings.push(`ロールが異なりますが上書きしません（現在: ${existing.role}）`);
      }
      items.push({
        type: 'unchanged',
        row: rowNo,
        email,
        name: existing.name,
        role: existing.role,
        userId: existing.id,
        warnings,
      });
    });

    // 削除: ファイルに載っていない有効ユーザー。
    // 「残る admin」= ファイルに載っている有効 admin + 復活予定の admin + 保護される実行者（admin の場合）。
    // 実行時は復活 → 追加 → 削除の順のため、復活 admin を数えてよい。
    let adminsLeft =
      all.filter((u) => !u.deletedAt && u.role === 'admin' && presentEmails.has(u.email)).length +
      items.filter((it) => it.type === 'restore' && it.role === 'admin').length +
      all.filter(
        (u) =>
          !u.deletedAt &&
          u.role === 'admin' &&
          u.id === actingUserId &&
          !presentEmails.has(u.email),
      ).length;

    for (const u of all) {
      if (u.deletedAt || presentEmails.has(u.email)) continue;
      let protectedReason: string | undefined;
      if (u.id === actingUserId) {
        protectedReason = '実行者自身のため削除されません';
      } else if (u.role === 'admin' && adminsLeft < 1) {
        // このユーザーまで消すと管理者が 0 人になる。作成日の古い順に 1 人残す
        protectedReason = '管理者が 0 人になるため削除されません';
        adminsLeft += 1;
      }
      items.push({
        type: 'delete',
        row: null,
        email: u.email,
        name: u.name,
        role: u.role,
        userId: u.id,
        warnings: [],
        ...(protectedReason ? { protectedReason } : {}),
      });
    }

    return { items };
  }

  async execute(
    tenantId: string,
    actingUserId: string,
    dto: UserSyncExecuteDto,
  ): Promise<UserSyncExecuteResult> {
    // 付与予定プロジェクトはユーザー作成前にまとめて検証する（作成後の付与で失敗させない）
    const allProjectIds = [...new Set(dto.actions.flatMap((a) => a.projectIds ?? []))];
    await this.access.assertProjectsInTenant(tenantId, allProjectIds);

    // 復活 → 追加 → 削除の順で適用する。復活した admin が「残る admin」に数えられ、
    // 最後の admin ガードが正しく効くようにするため
    const ordered = [
      ...dto.actions.filter((a) => a.type === 'restore'),
      ...dto.actions.filter((a) => a.type === 'create'),
      ...dto.actions.filter((a) => a.type === 'delete'),
    ];

    const items: UserSyncExecuteResultItem[] = [];
    const applied = { create: 0, restore: 0, delete: 0 };
    const seenCreateEmails = new Set<string>();

    for (const action of ordered) {
      let item: UserSyncExecuteResultItem;
      if (action.type === 'restore') {
        item = await this.applyRestore(tenantId, action);
      } else if (action.type === 'create') {
        item = await this.applyCreate(tenantId, action, seenCreateEmails);
      } else {
        item = await this.applyDelete(tenantId, actingUserId, action);
      }
      if (item.status === 'applied') applied[item.type] += 1;
      items.push(item);
    }

    return { applied, skipped: items.filter((it) => it.status === 'skipped').length, items };
  }

  private async applyRestore(
    tenantId: string,
    action: UserSyncActionDto,
  ): Promise<UserSyncExecuteResultItem> {
    const base = { type: 'restore' as const, email: action.email ?? '', name: '' };
    if (!action.userId) {
      return { ...base, status: 'skipped', reason: '対象ユーザーが指定されていません' };
    }
    const user = await this.users.findOne({
      where: { tenantId, id: action.userId },
      withDeleted: true,
    });
    if (!user) {
      return { ...base, status: 'skipped', reason: '対象ユーザーが見つかりません' };
    }
    if (!user.deletedAt) {
      return {
        ...base,
        email: user.email,
        name: user.name,
        status: 'skipped',
        reason: 'すでに有効なユーザーです',
      };
    }
    // deleted_at を NULL に戻すだけ。権限・紐づきは削除時に消していないため完全に元に戻る
    await this.users.restore(user.id);
    return { ...base, email: user.email, name: user.name, status: 'applied' };
  }

  private async applyCreate(
    tenantId: string,
    action: UserSyncActionDto,
    seenEmails: Set<string>,
  ): Promise<UserSyncExecuteResultItem> {
    const email = (action.email ?? '').trim().toLowerCase();
    const name = (action.name ?? '').trim();
    const base = { type: 'create' as const, email, name };
    if (!EMAIL_RE.test(email) || email.length > 255 || !name || name.length > 100 || !action.role) {
      return { ...base, status: 'skipped', reason: '追加内容が不正です' };
    }
    if (seenEmails.has(email)) {
      return { ...base, status: 'skipped', reason: '同じメールアドレスの追加が重複しています' };
    }
    seenEmails.add(email);
    const existing = await this.users.findOne({ where: { tenantId, email }, withDeleted: true });
    if (existing) {
      return {
        ...base,
        status: 'skipped',
        reason: 'すでに存在するメールアドレスです（プレビュー後に状態が変わった可能性があります）',
      };
    }
    // パスワードはランダム生成して誰にも見せない（Google SSO の email 自動紐づけで初回ログインする運用）
    const passwordHash = await bcrypt.hash(randomBytes(33).toString('base64url'), 10);
    const user = await this.users.save(
      this.users.create({ tenantId, email, name, role: action.role, passwordHash }),
    );
    await this.access.replaceForUser(tenantId, user.id, action.projectIds ?? []);
    return { ...base, status: 'applied' };
  }

  private async applyDelete(
    tenantId: string,
    actingUserId: string,
    action: UserSyncActionDto,
  ): Promise<UserSyncExecuteResultItem> {
    const base = { type: 'delete' as const, email: action.email ?? '', name: '' };
    if (!action.userId) {
      return { ...base, status: 'skipped', reason: '対象ユーザーが指定されていません' };
    }
    // find は削除済みを自動除外するため、すでに削除済みならヒットしない
    const user = await this.users.findOne({ where: { tenantId, id: action.userId } });
    if (!user) {
      return { ...base, status: 'skipped', reason: 'すでに削除されているか、見つかりません' };
    }
    if (user.id === actingUserId) {
      return {
        ...base,
        email: user.email,
        name: user.name,
        status: 'skipped',
        reason: '実行者自身は削除できません',
      };
    }
    if (user.role === 'admin') {
      const adminCount = await this.users.count({ where: { tenantId, role: 'admin' } });
      if (adminCount <= 1) {
        return {
          ...base,
          email: user.email,
          name: user.name,
          status: 'skipped',
          reason: '最後の管理者は削除できません',
        };
      }
    }
    await this.users.softRemove(user);
    return { ...base, email: user.email, name: user.name, status: 'applied' };
  }
}
