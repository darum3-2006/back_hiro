import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { AuditChange } from '../audit/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import { Comment } from '../comments/comment.entity';
import { Department } from '../departments/department.entity';
import { ProjectMember } from '../members/member.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Flag } from '../masters/flag.entity';
import { Tag } from '../masters/tag.entity';
import { TaskPriority } from '../masters/task-priority.entity';
import { TaskStatus } from '../masters/task-status.entity';
import { ProjectsService } from '../projects/projects.service';
import { SlackService } from '../slack/slack.service';
import { Subtask } from '../subtasks/subtask.entity';
import { BulkUpdateTasksDto } from './dto/bulk-update-tasks.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskFilterDto } from './dto/task-filter.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { buildTaskChanges, TaskChangeLabels, TaskFieldSnapshot } from './task-audit';
import { TaskFlag } from './task-flag.entity';
import { TaskTag } from './task-tag.entity';
import { Task, TaskLink } from './task.entity';

// 短縮コード生成は共通ユーティリティへ集約（SavedView 等と共用）。後方互換のため再エクスポートする。
export { generateShortCode } from '../common/short-code';
import { generateShortCode } from '../common/short-code';

/**
 * フロント返却用の Task DTO 形（id 含む、tag は code 配列）。
 */
export interface TaskResponse {
  id: string;
  projectId: string;
  shortCode: string;
  seq: number;
  content: string;
  description: string;
  links: TaskLink[];
  statusCode: string;
  priorityCode: string | null;
  assigneeMemberId: string | null;
  requesterMemberId: string | null;
  requestingDeptCode: string | null;
  deadline: string | null;
  plannedStartDate: string | null;
  plannedCompletionDate: string | null;
  plannedReleaseDate: string | null;
  completedAt: Date | null;
  statusChangedAt: Date;
  tagCodes: string[];
  flagCodes: string[];
  /** このタスクに付いたコメント件数（一覧のアイコン表示用） */
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ホームダッシュボード用の「自分のタスク」DTO 形。
 * プロジェクト横断のため projectId / projectName を含み、表示に必要な最小限に絞る。
 */
export interface MyTaskResponse {
  shortCode: string;
  seq: number;
  content: string;
  statusCode: string;
  statusLabel: string;
  /** ステータスマスタの表示色（プロジェクト設定）。UI のバッジ色に使う。 */
  statusColor: string;
  priorityCode: string | null;
  deadline: string | null;
  projectId: string;
  projectName: string;
}

/** タスク履歴（監査ログ）のフロント返却用 DTO 形。 */
export interface TaskActivityResponse {
  id: string;
  action: string;
  changes: AuditChange[] | null;
  actor: { userId: string | null; name: string | null };
  createdAt: Date;
}

/** グローバル検索の結果 1 件（テナント横断）。 */
export interface TaskSearchResult {
  shortCode: string;
  seq: number;
  content: string;
  statusCode: string;
  statusLabel: string;
  projectId: string;
  projectName: string;
}

// LIKE のメタ文字をエスケープ（ユーザー入力をリテラル一致させる）
const escapeLike = (s: string): string => s.replace(/[\\%_]/g, (m) => `\\${m}`);

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    @InjectRepository(TaskTag)
    private readonly taskTags: Repository<TaskTag>,
    @InjectRepository(Tag)
    private readonly tags: Repository<Tag>,
    @InjectRepository(Flag)
    private readonly flags: Repository<Flag>,
    @InjectRepository(TaskFlag)
    private readonly taskFlags: Repository<TaskFlag>,
    @InjectRepository(TaskStatus)
    private readonly statuses: Repository<TaskStatus>,
    @InjectRepository(TaskPriority)
    private readonly priorities: Repository<TaskPriority>,
    @InjectRepository(ProjectMember)
    private readonly members: Repository<ProjectMember>,
    @InjectRepository(Department)
    private readonly departments: Repository<Department>,
    @InjectRepository(Comment)
    private readonly comments: Repository<Comment>,
    @InjectRepository(Subtask)
    private readonly subtasks: Repository<Subtask>,
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly slack: SlackService,
  ) {}

  async listByProject(
    tenantId: string,
    projectId: string,
    filter: TaskFilterDto = {},
  ): Promise<TaskResponse[]> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const qb = this.queryBuilder(projectId, filter);
    // 既定では完了（終端ステータス）タスクを除外する（一覧の取得ペイロード削減）。
    // ステータスマスタの is_terminal を正とし、対応マスタが無い場合は未完了扱い（表示）。
    // count は削除ガード等で全件数が要るため、この除外は listByProject だけに適用する。
    if (!filter.includeCompleted) {
      qb.leftJoin(
        TaskStatus,
        's',
        's.project_id = t.project_id AND s.code = t.status_code',
      ).andWhere('(s.is_terminal IS NULL OR s.is_terminal = false)');
    }
    const tasks = await qb.orderBy('t.created_at', 'ASC').getMany();
    return this.attachTagCodes(tasks);
  }

  async count(tenantId: string, projectId: string, filter: TaskFilterDto = {}): Promise<number> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    return this.queryBuilder(projectId, filter).getCount();
  }

  async findInProject(tenantId: string, projectId: string, id: string): Promise<TaskResponse> {
    const task = await this.findEntityInProject(tenantId, projectId, id);
    const [withTags] = await this.attachTagCodes([task]);
    return withTags;
  }

  /** 公開API用：プロジェクト内連番(seq)でタスクを引く。 */
  async findBySeqInProject(
    tenantId: string,
    projectId: string,
    seq: number,
  ): Promise<TaskResponse> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const task = await this.tasks.findOne({ where: { projectId, seq } });
    if (!task) throw new NotFoundException('タスクが見つかりません');
    const [withTags] = await this.attachTagCodes([task]);
    return withTags;
  }

  /**
   * ホームダッシュボード用：自分（userId）が担当の「未完了」タスクをテナント横断で返す。
   * - 担当 = assignee メンバーの user_id が一致（メンバーはプロジェクトごとに別行）
   * - 未完了 = ステータスが非終端（is_terminal = false）
   * - アーカイブ済みプロジェクトは除外
   * - 並び: 期限の昇順（未設定は末尾）、次いで作成順
   */
  async listMyOpenTasks(tenantId: string, userId: string): Promise<MyTaskResponse[]> {
    const rows = await this.tasks
      .createQueryBuilder('t')
      .innerJoin('t.project', 'p')
      .innerJoin(ProjectMember, 'am', 'am.id = t.assignee_member_id')
      .innerJoin(TaskStatus, 's', 's.project_id = t.project_id AND s.code = t.status_code')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.archived_at IS NULL')
      .andWhere('am.user_id = :userId', { userId })
      .andWhere('s.is_terminal = false')
      .orderBy('t.deadline IS NULL', 'ASC')
      .addOrderBy('t.deadline', 'ASC')
      .addOrderBy('t.created_at', 'ASC')
      .select([
        't.short_code AS shortCode',
        't.seq AS seq',
        't.content AS content',
        't.status_code AS statusCode',
        's.label AS statusLabel',
        's.color AS statusColor',
        't.priority_code AS priorityCode',
        't.deadline AS deadline',
        't.project_id AS projectId',
        'p.name AS projectName',
      ])
      .getRawMany<{
        shortCode: string;
        seq: number;
        content: string;
        statusCode: string;
        statusLabel: string;
        statusColor: string;
        priorityCode: string | null;
        deadline: string | null;
        projectId: string;
        projectName: string;
      }>();
    return rows.map((r) => ({ ...r, seq: Number(r.seq) }));
  }

  /**
   * 共有リンク用の短縮コードからタスクを解決する。
   * Project 経由で tenant_id をスコープし、他テナントのコードは 404 にする。
   */
  async resolveByCode(tenantId: string, code: string): Promise<{ projectId: string; id: string }> {
    const task = await this.tasks
      .createQueryBuilder('t')
      .innerJoin('t.project', 'p')
      .where('t.short_code = :code', { code })
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .select(['t.id', 't.projectId'])
      .getOne();
    if (!task) throw new NotFoundException('タスクが見つかりません');
    return { projectId: task.projectId, id: task.id };
  }

  /**
   * グローバル検索（テナント横断）。タイトル/説明/関連リンク(URL・ラベル)の部分一致、
   * short_code 完全一致、seq（#15 / 15）一致でタスクを引く。アーカイブ済みプロジェクトは除外。
   */
  async search(tenantId: string, rawQuery: string, limit = 20): Promise<TaskSearchResult[]> {
    const q = rawQuery.trim();
    if (!q) return [];
    const take = Math.min(Math.max(limit, 1), 50);
    const like = `%${escapeLike(q)}%`;
    // 「#15」「15」のような数値はプロジェクト内連番(seq)としても照合する
    const seqMatch = /^#?(\d+)$/.exec(q);
    const seq = seqMatch ? Number(seqMatch[1]) : null;

    const qb = this.tasks
      .createQueryBuilder('t')
      .innerJoin('t.project', 'p')
      .innerJoin(TaskStatus, 's', 's.project_id = t.project_id AND s.code = t.status_code')
      .where('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.archived_at IS NULL')
      .andWhere(
        // links は JSON 列。文字列化して LIKE すれば URL / ラベルの部分一致を拾える
        `(t.content LIKE :like OR t.description LIKE :like OR t.links LIKE :like
          OR t.short_code = :code${seq !== null ? ' OR t.seq = :seq' : ''})`,
        seq !== null ? { like, code: q, seq } : { like, code: q },
      )
      // 短縮コード完全一致を最優先、次いでタイトル一致、あとは新しい順
      .orderBy('t.short_code = :code', 'DESC')
      .addOrderBy('t.content LIKE :like', 'DESC')
      .addOrderBy('t.created_at', 'DESC')
      .select([
        't.short_code AS shortCode',
        't.seq AS seq',
        't.content AS content',
        't.status_code AS statusCode',
        's.label AS statusLabel',
        't.project_id AS projectId',
        'p.name AS projectName',
      ])
      .limit(take);

    const rows = await qb.getRawMany<{
      shortCode: string;
      seq: number;
      content: string;
      statusCode: string;
      statusLabel: string;
      projectId: string;
      projectName: string;
    }>();
    return rows.map((r) => ({ ...r, seq: Number(r.seq) }));
  }

  async create(
    tenantId: string,
    projectId: string,
    dto: CreateTaskDto,
    actingUserId: string,
  ): Promise<TaskResponse> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const seq = await this.nextSeq(projectId);
    const shortCode = await this.nextShortCode();
    const completedAt = await this.resolveCompletedAt(projectId, null, dto.statusCode, null);
    const task = this.tasks.create({
      projectId,
      seq,
      shortCode,
      content: dto.content.trim(),
      description: dto.description ?? '',
      links: dto.links ?? [],
      statusCode: dto.statusCode,
      priorityCode: dto.priorityCode ?? null,
      assigneeMemberId: dto.assigneeMemberId ?? null,
      requesterMemberId: dto.requesterMemberId ?? null,
      requestingDeptCode: dto.requestingDeptCode ?? null,
      deadline: dto.deadline ?? null,
      plannedStartDate: dto.plannedStartDate ?? null,
      plannedCompletionDate: dto.plannedCompletionDate ?? null,
      plannedReleaseDate: dto.plannedReleaseDate ?? null,
      completedAt,
      // 新規作成時は初期ステータスの設定 = 最初のステータス変更とみなす
      statusChangedAt: new Date(),
    });
    const saved = await this.tasks.manager.transaction(async (em) => {
      const s = await em.save(task);
      if (dto.tagCodes && dto.tagCodes.length > 0) {
        await this.replaceTaskTags(projectId, s.id, dto.tagCodes, em);
      }
      if (dto.flagCodes && dto.flagCodes.length > 0) {
        await this.replaceTaskFlags(projectId, s.id, dto.flagCodes, em);
      }
      await this.audit.record(
        {
          tenantId,
          entityType: 'task',
          entityId: s.id,
          projectId,
          action: 'create',
          actorUserId: actingUserId,
        },
        em,
      );
      return s;
    });
    // 通知はトランザクション外でベストエフォート生成（失敗してもタスク作成は成立させる）
    await this.notifications.onTaskCreated(tenantId, saved, actingUserId);
    await this.slack.notifyTaskCreated(tenantId, saved);
    return this.findInProject(tenantId, projectId, saved.id);
  }

  async update(
    tenantId: string,
    projectId: string,
    id: string,
    dto: UpdateTaskDto,
    actingUserId: string,
  ): Promise<TaskResponse> {
    const task = await this.findEntityInProject(tenantId, projectId, id);
    // 親を終端（完了扱い）へ変えるには、サブタスクが全完了していること（副作用前に fail-fast）
    if (dto.statusCode !== undefined && dto.statusCode !== task.statusCode) {
      const newStatus = await this.statuses.findOne({
        where: { projectId, code: dto.statusCode },
      });
      if (newStatus?.isTerminal === true) {
        const incomplete = await this.subtasks.count({ where: { taskId: id, done: false } });
        if (incomplete > 0) {
          throw new BadRequestException(
            `未完了のサブタスクが ${incomplete} 件あります。先に完了してください`,
          );
        }
      }
    }
    // Slack の「完了」判定用に、変更前の完了状態を控える
    const wasCompleted = task.completedAt !== null;
    const beforeTagCodes = await this.getTagCodes(task.id);
    const beforeFlagCodes = await this.getFlagCodes(task.id);
    const before = this.snapshotOf(task, beforeTagCodes, beforeFlagCodes);

    if (dto.content !== undefined) task.content = dto.content.trim();
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.links !== undefined) task.links = dto.links;
    if (dto.statusCode !== undefined && dto.statusCode !== task.statusCode) {
      task.completedAt = await this.resolveCompletedAt(
        projectId,
        task.statusCode,
        dto.statusCode,
        task.completedAt,
      );
      task.statusCode = dto.statusCode;
      task.statusChangedAt = new Date();
    }
    if (dto.priorityCode !== undefined) task.priorityCode = dto.priorityCode ?? null;
    if (dto.assigneeMemberId !== undefined) task.assigneeMemberId = dto.assigneeMemberId ?? null;
    if (dto.requesterMemberId !== undefined) task.requesterMemberId = dto.requesterMemberId ?? null;
    if (dto.requestingDeptCode !== undefined) {
      task.requestingDeptCode = dto.requestingDeptCode ?? null;
    }
    if (dto.deadline !== undefined) task.deadline = dto.deadline ?? null;
    if (dto.plannedStartDate !== undefined) {
      task.plannedStartDate = dto.plannedStartDate ?? null;
    }
    if (dto.plannedCompletionDate !== undefined) {
      task.plannedCompletionDate = dto.plannedCompletionDate ?? null;
    }
    if (dto.plannedReleaseDate !== undefined) {
      task.plannedReleaseDate = dto.plannedReleaseDate ?? null;
    }

    // タグ更新時は実際に保存される有効コードのみで差分を取る（不正コードは無視されるため）。
    const afterTagCodes =
      dto.tagCodes !== undefined
        ? await this.resolveValidTagCodes(projectId, dto.tagCodes)
        : beforeTagCodes;
    const afterFlagCodes =
      dto.flagCodes !== undefined
        ? await this.resolveValidFlagCodes(projectId, dto.flagCodes)
        : beforeFlagCodes;
    const after = this.snapshotOf(task, afterTagCodes, afterFlagCodes);
    const labels = await this.resolveChangeLabels(tenantId, projectId, before, after);
    const changes = buildTaskChanges(before, after, labels);

    await this.tasks.manager.transaction(async (em) => {
      await em.save(task);
      if (dto.tagCodes !== undefined) {
        await this.replaceTaskTags(projectId, task.id, dto.tagCodes, em);
      }
      if (dto.flagCodes !== undefined) {
        await this.replaceTaskFlags(projectId, task.id, dto.flagCodes, em);
      }
      if (changes.length > 0) {
        await this.audit.record(
          {
            tenantId,
            entityType: 'task',
            entityId: task.id,
            projectId,
            action: 'update',
            changes,
            actorUserId: actingUserId,
          },
          em,
        );
      }
    });
    if (changes.length > 0) {
      await this.notifications.onTaskChanged(tenantId, task, changes, actingUserId);
    }
    // Slack 通知: ステータス変更を「完了（終端への新規遷移）」と「それ以外」に振り分ける。
    // 終端→別の終端（完了の付け替え）は完了通知を再送しない。
    const statusChange = changes.find((c) => c.field === 'status');
    if (statusChange) {
      const nowCompleted = task.completedAt !== null;
      const label = statusChange.newLabel ?? statusChange.new ?? '';
      if (nowCompleted && !wasCompleted) {
        await this.slack.notifyTaskCompleted(tenantId, task, label);
      } else if (!nowCompleted) {
        await this.slack.notifyTaskStatusChanged(tenantId, task, label);
      }
    }
    return this.findInProject(tenantId, projectId, task.id);
  }

  /**
   * 一括編集。ids の各タスクへ指定フィールドを適用する。
   * - 監査ログ・通知を確実に発火させるため、タスクごとに既存の update() を呼ぶ
   * - タグ / フラグは add / remove の差分を各タスクの現在値に対して計算してから置換する
   * - 指定が空（実質変更なし）のタスクはスキップ。存在しない id も静かにスキップする
   * 戻り値は実際に更新できた件数。
   */
  async bulkUpdate(
    tenantId: string,
    projectId: string,
    dto: BulkUpdateTasksDto,
    actingUserId: string,
  ): Promise<{ updated: number }> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const { ids, addTagCodes, removeTagCodes, addFlagCodes, removeFlagCodes, ...scalar } = dto;
    const touchesTags = (addTagCodes?.length ?? 0) > 0 || (removeTagCodes?.length ?? 0) > 0;
    const touchesFlags = (addFlagCodes?.length ?? 0) > 0 || (removeFlagCodes?.length ?? 0) > 0;

    let updated = 0;
    for (const id of ids) {
      const patch: UpdateTaskDto = {};
      if (scalar.statusCode !== undefined) patch.statusCode = scalar.statusCode;
      if (scalar.assigneeMemberId !== undefined) patch.assigneeMemberId = scalar.assigneeMemberId;
      if (scalar.priorityCode !== undefined) patch.priorityCode = scalar.priorityCode;
      if (scalar.deadline !== undefined) patch.deadline = scalar.deadline;
      if (scalar.plannedStartDate !== undefined) patch.plannedStartDate = scalar.plannedStartDate;
      if (scalar.plannedCompletionDate !== undefined) {
        patch.plannedCompletionDate = scalar.plannedCompletionDate;
      }
      if (touchesTags) {
        const current = new Set(await this.getTagCodes(id));
        for (const c of addTagCodes ?? []) current.add(c);
        for (const c of removeTagCodes ?? []) current.delete(c);
        patch.tagCodes = [...current];
      }
      if (touchesFlags) {
        const current = new Set(await this.getFlagCodes(id));
        for (const c of addFlagCodes ?? []) current.add(c);
        for (const c of removeFlagCodes ?? []) current.delete(c);
        patch.flagCodes = [...current];
      }
      if (Object.keys(patch).length === 0) continue;
      try {
        await this.update(tenantId, projectId, id, patch, actingUserId);
        updated++;
      } catch (e) {
        // 他テナント/別プロジェクトの id は 404、未完了サブタスクを持つ親の完了は 400。
        // どちらも一括処理は止めずスキップする（更新件数に数えない）。
        if (!(e instanceof NotFoundException) && !(e instanceof BadRequestException)) throw e;
      }
    }
    return { updated };
  }

  async remove(
    tenantId: string,
    projectId: string,
    id: string,
    actingUserId: string,
  ): Promise<void> {
    const task = await this.findEntityInProject(tenantId, projectId, id);
    await this.tasks.manager.transaction(async (em) => {
      await em.remove(task);
      await this.audit.record(
        {
          tenantId,
          entityType: 'task',
          entityId: id,
          projectId,
          action: 'delete',
          actorUserId: actingUserId,
        },
        em,
      );
    });
  }

  /** タスクの履歴（監査ログ）を時系列で返す。 */
  async listActivities(
    tenantId: string,
    projectId: string,
    id: string,
  ): Promise<TaskActivityResponse[]> {
    await this.findEntityInProject(tenantId, projectId, id);
    const logs = await this.audit.listForEntity(tenantId, 'task', id);
    return logs.map((l) => ({
      id: l.id,
      action: l.action,
      changes: l.changes,
      actor: { userId: l.actorUserId, name: l.actorUserName },
      createdAt: l.createdAt,
    }));
  }

  // ===== 内部ヘルパ =====

  private async findEntityInProject(
    tenantId: string,
    projectId: string,
    id: string,
  ): Promise<Task> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const task = await this.tasks.findOne({ where: { projectId, id } });
    if (!task) throw new NotFoundException('タスクが見つかりません');
    return task;
  }

  /**
   * ステータス遷移に対する completed_at の新値を返す。
   * - 新ステータスが terminal: 現在時刻（旧が terminal でも上書き）
   * - 旧 terminal -> 新 non-terminal: null
   * - 旧 non-terminal -> 新 non-terminal: 既存値を維持
   * - 旧と新が同じ: 既存値を維持
   */
  private async resolveCompletedAt(
    projectId: string,
    oldStatusCode: string | null,
    newStatusCode: string,
    currentCompletedAt: Date | null,
  ): Promise<Date | null> {
    if (oldStatusCode === newStatusCode) return currentCompletedAt;
    const [oldStatus, newStatus] = await Promise.all([
      oldStatusCode
        ? this.statuses.findOne({ where: { projectId, code: oldStatusCode } })
        : Promise.resolve(null),
      this.statuses.findOne({ where: { projectId, code: newStatusCode } }),
    ]);
    const newIsTerminal = newStatus?.isTerminal === true;
    const oldIsTerminal = oldStatus?.isTerminal === true;
    if (newIsTerminal) return new Date();
    if (oldIsTerminal) return null;
    return currentCompletedAt;
  }

  private async nextSeq(projectId: string): Promise<number> {
    const row = await this.tasks
      .createQueryBuilder('t')
      .select('MAX(t.seq)', 'maxSeq')
      .where('t.project_id = :projectId', { projectId })
      .getRawOne<{ maxSeq: number | null }>();
    return (row?.maxSeq ?? 0) + 1;
  }

  /**
   * 未使用の短縮コードを採番する。
   * 衝突は天文学的に稀だが、unique 制約の手前で DB を引いて確認しリトライする。
   */
  private async nextShortCode(): Promise<string> {
    for (let i = 0; i < 5; i++) {
      const code = generateShortCode();
      const exists = await this.tasks.findOne({
        where: { shortCode: code },
        select: { id: true },
      });
      if (!exists) return code;
    }
    throw new Error('短縮コードの生成に失敗しました');
  }

  /**
   * tag_codes 配列に従って task_tags を全置換。
   * 不正な tagCode（同プロジェクト内に存在しない）は黙って無視。
   * manager を渡すと呼び出し側のトランザクションに参加する（未指定なら自前で張る）。
   */
  private async replaceTaskTags(
    projectId: string,
    taskId: string,
    tagCodes: string[],
    manager?: EntityManager,
  ): Promise<void> {
    const run = async (em: EntityManager) => {
      const tagsRepo = em.getRepository(Tag);
      const tagsInProject = await tagsRepo.find({
        where: { projectId, code: In(tagCodes) },
      });
      const ttRepo = em.getRepository(TaskTag);
      await ttRepo.delete({ taskId });
      if (tagsInProject.length === 0) return;
      const rows = tagsInProject.map((t) => ttRepo.create({ taskId, tagId: t.id }));
      await ttRepo.save(rows);
    };
    if (manager) return run(manager);
    return this.taskTags.manager.transaction(run);
  }

  /**
   * flag_codes 配列に従って task_flags を全置換。
   * 不正な flagCode（同プロジェクト内に存在しない）は黙って無視。
   * manager を渡すと呼び出し側のトランザクションに参加する（未指定なら自前で張る）。
   */
  private async replaceTaskFlags(
    projectId: string,
    taskId: string,
    flagCodes: string[],
    manager?: EntityManager,
  ): Promise<void> {
    const run = async (em: EntityManager) => {
      const flagsRepo = em.getRepository(Flag);
      const flagsInProject = await flagsRepo.find({
        where: { projectId, code: In(flagCodes) },
      });
      const tfRepo = em.getRepository(TaskFlag);
      await tfRepo.delete({ taskId });
      if (flagsInProject.length === 0) return;
      const rows = flagsInProject.map((f) => tfRepo.create({ taskId, flagId: f.id }));
      await tfRepo.save(rows);
    };
    if (manager) return run(manager);
    return this.taskFlags.manager.transaction(run);
  }

  /** 監査差分用に、タスクの現在のタグコード一覧を返す。 */
  private async getTagCodes(taskId: string): Promise<string[]> {
    const rows = await this.taskTags
      .createQueryBuilder('tt')
      .innerJoin(Tag, 'tag', 'tag.id = tt.tag_id')
      .select('tag.code', 'code')
      .where('tt.task_id = :taskId', { taskId })
      .getRawMany<{ code: string }>();
    return rows.map((r) => r.code);
  }

  /** 監査差分用に、タスクの現在のフラグコード一覧を返す。 */
  private async getFlagCodes(taskId: string): Promise<string[]> {
    const rows = await this.taskFlags
      .createQueryBuilder('tf')
      .innerJoin(Flag, 'flag', 'flag.id = tf.flag_id')
      .select('flag.code', 'code')
      .where('tf.task_id = :taskId', { taskId })
      .getRawMany<{ code: string }>();
    return rows.map((r) => r.code);
  }

  /** 指定コードのうち同プロジェクトに実在するものだけを返す（保存される集合と一致させる）。 */
  private async resolveValidTagCodes(projectId: string, codes: string[]): Promise<string[]> {
    if (codes.length === 0) return [];
    const rows = await this.tags.find({
      where: { projectId, code: In(codes) },
      select: { code: true },
    });
    return rows.map((r) => r.code);
  }

  /** 指定コードのうち同プロジェクトに実在するフラグだけを返す。 */
  private async resolveValidFlagCodes(projectId: string, codes: string[]): Promise<string[]> {
    if (codes.length === 0) return [];
    const rows = await this.flags.find({
      where: { projectId, code: In(codes) },
      select: { code: true },
    });
    return rows.map((r) => r.code);
  }

  /** Task エンティティと tagCodes / flagCodes から監査差分用スナップショットを作る。 */
  private snapshotOf(task: Task, tagCodes: string[], flagCodes: string[]): TaskFieldSnapshot {
    return {
      content: task.content,
      description: task.description,
      statusCode: task.statusCode,
      priorityCode: task.priorityCode,
      assigneeMemberId: task.assigneeMemberId,
      requesterMemberId: task.requesterMemberId,
      requestingDeptCode: task.requestingDeptCode,
      deadline: task.deadline,
      plannedStartDate: task.plannedStartDate,
      plannedCompletionDate: task.plannedCompletionDate,
      plannedReleaseDate: task.plannedReleaseDate,
      links: task.links,
      tagCodes,
      flagCodes,
    };
  }

  /**
   * 前後スナップショットに現れる code / id の表示ラベルをまとめて引く。
   * 変更されたフィールド由来の値のみを対象にしたいが、union でも件数は小さいので
   * 簡潔さを優先して before/after 双方の値を集めて解決する。
   */
  private async resolveChangeLabels(
    tenantId: string,
    projectId: string,
    before: TaskFieldSnapshot,
    after: TaskFieldSnapshot,
  ): Promise<TaskChangeLabels> {
    const uniq = (xs: (string | null)[]): string[] => [
      ...new Set(xs.filter((x): x is string => x !== null)),
    ];

    const statusCodes = uniq([before.statusCode, after.statusCode]);
    const priorityCodes = uniq([before.priorityCode, after.priorityCode]);
    const memberIds = uniq([
      before.assigneeMemberId,
      after.assigneeMemberId,
      before.requesterMemberId,
      after.requesterMemberId,
    ]);
    const deptCodes = uniq([before.requestingDeptCode, after.requestingDeptCode]);
    const tagCodes = uniq([...before.tagCodes, ...after.tagCodes]);
    const flagCodes = uniq([...before.flagCodes, ...after.flagCodes]);

    const [statuses, priorities, members, depts, tags, flagRows] = await Promise.all([
      statusCodes.length
        ? this.statuses.find({ where: { projectId, code: In(statusCodes) } })
        : Promise.resolve([]),
      priorityCodes.length
        ? this.priorities.find({ where: { projectId, code: In(priorityCodes) } })
        : Promise.resolve([]),
      memberIds.length
        ? this.members.find({ where: { projectId, id: In(memberIds) } })
        : Promise.resolve([]),
      deptCodes.length
        ? this.departments.find({ where: { tenantId, code: In(deptCodes) } })
        : Promise.resolve([]),
      tagCodes.length
        ? this.tags.find({ where: { projectId, code: In(tagCodes) } })
        : Promise.resolve([]),
      flagCodes.length
        ? this.flags.find({ where: { projectId, code: In(flagCodes) } })
        : Promise.resolve([]),
    ]);

    return {
      status: new Map(statuses.map((s) => [s.code, s.label])),
      priority: new Map(priorities.map((p) => [p.code, p.label])),
      member: new Map(members.map((m) => [m.id, m.displayName])),
      dept: new Map(depts.map((d) => [d.code, d.name])),
      tag: new Map(tags.map((t) => [t.code, t.name])),
      flag: new Map(flagRows.map((f) => [f.code, f.name])),
    };
  }

  private async attachTagCodes(tasks: Task[]): Promise<TaskResponse[]> {
    if (tasks.length === 0) return [];
    const ids = tasks.map((t) => t.id);
    const rows = await this.taskTags
      .createQueryBuilder('tt')
      .innerJoin(Tag, 'tag', 'tag.id = tt.tag_id')
      .select(['tt.task_id AS taskId', 'tag.code AS code'])
      .where('tt.task_id IN (:...ids)', { ids })
      .getRawMany<{ taskId: string; code: string }>();
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const arr = map.get(r.taskId) ?? [];
      arr.push(r.code);
      map.set(r.taskId, arr);
    }
    // フラグコード（task ごと、タグと同じ流儀で 1 クエリ）
    const flagRows = await this.taskFlags
      .createQueryBuilder('tf')
      .innerJoin(Flag, 'flag', 'flag.id = tf.flag_id')
      .select(['tf.task_id AS taskId', 'flag.code AS code'])
      .where('tf.task_id IN (:...ids)', { ids })
      .getRawMany<{ taskId: string; code: string }>();
    const flagMap = new Map<string, string[]>();
    for (const r of flagRows) {
      const arr = flagMap.get(r.taskId) ?? [];
      arr.push(r.code);
      flagMap.set(r.taskId, arr);
    }
    // コメント件数（task ごとに 1 クエリでまとめて集計）。コメントはハード削除なので生 COUNT で良い。
    const countRows = await this.comments
      .createQueryBuilder('c')
      .select('c.task_id', 'taskId')
      .addSelect('COUNT(*)', 'cnt')
      .where('c.task_id IN (:...ids)', { ids })
      .groupBy('c.task_id')
      .getRawMany<{ taskId: string; cnt: string }>();
    const countMap = new Map(countRows.map((r) => [r.taskId, Number(r.cnt)]));
    return tasks.map((t) =>
      this.toResponse(t, map.get(t.id) ?? [], flagMap.get(t.id) ?? [], countMap.get(t.id) ?? 0),
    );
  }

  private toResponse(
    t: Task,
    tagCodes: string[],
    flagCodes: string[],
    commentCount: number,
  ): TaskResponse {
    return {
      id: t.id,
      projectId: t.projectId,
      shortCode: t.shortCode,
      seq: t.seq,
      content: t.content,
      description: t.description,
      links: t.links,
      statusCode: t.statusCode,
      priorityCode: t.priorityCode,
      assigneeMemberId: t.assigneeMemberId,
      requesterMemberId: t.requesterMemberId,
      requestingDeptCode: t.requestingDeptCode,
      deadline: t.deadline,
      plannedStartDate: t.plannedStartDate,
      plannedCompletionDate: t.plannedCompletionDate,
      plannedReleaseDate: t.plannedReleaseDate,
      completedAt: t.completedAt,
      statusChangedAt: t.statusChangedAt,
      tagCodes,
      flagCodes,
      commentCount,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  private queryBuilder(projectId: string, filter: TaskFilterDto) {
    const qb = this.tasks.createQueryBuilder('t').where('t.project_id = :projectId', { projectId });
    if (filter.statusCode) qb.andWhere('t.status_code = :s', { s: filter.statusCode });
    if (filter.priorityCode) qb.andWhere('t.priority_code = :p', { p: filter.priorityCode });
    if (filter.assigneeMemberId) {
      qb.andWhere('t.assignee_member_id = :a', { a: filter.assigneeMemberId });
    }
    if (filter.requesterMemberId) {
      qb.andWhere('t.requester_member_id = :r', { r: filter.requesterMemberId });
    }
    if (filter.requestingDeptCode) {
      qb.andWhere('t.requesting_dept_code = :d', { d: filter.requestingDeptCode });
    }
    if (filter.tagCode) {
      qb.andWhere(
        `t.id IN (
          SELECT tt.task_id FROM task_tags tt
          INNER JOIN tags g ON g.id = tt.tag_id AND g.project_id = :projectId
          WHERE g.code = :tagCode
        )`,
        { projectId, tagCode: filter.tagCode },
      );
    }
    if (filter.flagCode) {
      qb.andWhere(
        `t.id IN (
          SELECT tf.task_id FROM task_flags tf
          INNER JOIN flags fl ON fl.id = tf.flag_id AND fl.project_id = :projectId
          WHERE fl.code = :flagCode
        )`,
        { projectId, flagCode: filter.flagCode },
      );
    }
    return qb;
  }
}
