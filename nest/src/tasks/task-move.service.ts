import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { AuditChange } from '../audit/audit-log.entity';
import { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Comment } from '../comments/comment.entity';
import { Flag } from '../masters/flag.entity';
import { Tag } from '../masters/tag.entity';
import { TaskPriority } from '../masters/task-priority.entity';
import { TaskStatus } from '../masters/task-status.entity';
import { ProjectMember } from '../members/member.entity';
import { Notification } from '../notifications/notification.entity';
import { ProjectAccessService } from '../projects/project-access.service';
import { Project } from '../projects/project.entity';
import { SubtaskFlag } from '../subtasks/subtask-flag.entity';
import { Subtask } from '../subtasks/subtask.entity';
import { TaskRelation } from '../task-relations/task-relation.entity';
import { MoveTaskDto } from './dto/move-task.dto';
import { TaskFlag } from './task-flag.entity';
import { TaskTag } from './task-tag.entity';
import { Task } from './task.entity';

/** 移動先の選択肢 1 件 */
interface MoveOption {
  value: string;
  label: string;
  color?: string;
}

/** 移動で失われるもの・付け替わるものの見込み（ダイアログの「元に戻せません」に出す） */
export interface TaskMovePreview {
  task: { id: string; seq: number; content: string };
  target: { id: string; name: string };
  /** 付け替えの初期値。移動先に同じものが無ければ null（ステータスは必ず埋まる） */
  defaults: {
    statusCode: string;
    priorityCode: string | null;
    assigneeMemberId: string | null;
    requesterMemberId: string | null;
  };
  /** 移動元での値（「外れます」を出すための表示名） */
  source: {
    statusLabel: string | null;
    priorityLabel: string | null;
    assigneeName: string | null;
    requesterName: string | null;
  };
  options: {
    statuses: MoveOption[];
    priorities: MoveOption[];
    /** 担当者にできるメンバー（readonly ユーザーに紐づくメンバーは除く） */
    assignees: MoveOption[];
    /** 依頼者にできるメンバー（全員） */
    requesters: MoveOption[];
  };
  tags: { kept: string[]; dropped: string[] };
  flags: { kept: string[]; dropped: string[] };
  subtasks: { count: number; droppedAssignees: string[]; droppedFlags: string[] };
  comments: { count: number; unknownAuthors: { name: string; count: number }[] };
  relations: { count: number };
}

/** 同じ名前か（前後の空白を除いた完全一致） */
const sameName = (a: string | null | undefined, b: string | null | undefined): boolean =>
  (a ?? '').trim() !== '' && (a ?? '').trim() === (b ?? '').trim();

const uniq = <T>(xs: T[]): T[] => [...new Set(xs)];

/**
 * タスクのプロジェクト間移動（設計: docs/TASK_MOVE.md）。
 *
 * 付け替えの規則は preview と move で共通にし、画面が見せた「失われるもの」と
 * 実際の移動の結果が食い違わないようにする。移動は元に戻せないので、1 トランザクションで行い、
 * 途中で失敗したら何も変えない。
 */
@Injectable()
export class TaskMoveService {
  constructor(
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    private readonly access: ProjectAccessService,
    private readonly audit: AuditService,
  ) {}

  async preview(
    user: AuthenticatedUser,
    sourceProjectId: string,
    taskId: string,
    targetProjectId: string,
  ): Promise<TaskMovePreview> {
    const ctx = await this.load(this.tasks.manager, user, sourceProjectId, taskId, targetProjectId);
    const plan = this.plan(ctx);
    const src = ctx.source;
    return {
      task: { id: ctx.task.id, seq: ctx.task.seq, content: ctx.task.content },
      target: { id: ctx.targetProject.id, name: ctx.targetProject.name },
      defaults: {
        statusCode: plan.statusCode,
        priorityCode: plan.priorityCode,
        assigneeMemberId: plan.assigneeMemberId,
        requesterMemberId: plan.requesterMemberId,
      },
      source: {
        statusLabel: src.status?.label ?? null,
        priorityLabel: src.priority?.label ?? null,
        assigneeName: src.assignee?.displayName ?? null,
        requesterName: src.requester?.displayName ?? null,
      },
      options: {
        statuses: ctx.target.statuses.map((s) => ({
          value: s.code,
          label: s.label,
          color: s.color,
        })),
        priorities: ctx.target.priorities.map((p) => ({
          value: p.code,
          label: p.label,
          color: p.color,
        })),
        assignees: ctx.target.members
          .filter((m) => this.assignable(m))
          .map((m) => ({ value: m.id, label: m.displayName })),
        requesters: ctx.target.members.map((m) => ({ value: m.id, label: m.displayName })),
      },
      tags: { kept: plan.tags.map((t) => t.name), dropped: plan.droppedTagNames },
      flags: { kept: plan.flags.map((f) => f.name), dropped: plan.droppedFlagNames },
      subtasks: {
        count: ctx.subtasks.length,
        droppedAssignees: plan.droppedSubtaskAssigneeNames,
        droppedFlags: plan.droppedSubtaskFlagNames,
      },
      comments: { count: ctx.comments.length, unknownAuthors: plan.unknownAuthors },
      relations: { count: ctx.relationCount },
    };
  }

  async move(
    user: AuthenticatedUser,
    sourceProjectId: string,
    taskId: string,
    dto: MoveTaskDto,
  ): Promise<{ projectId: string; id: string; seq: number; shortCode: string }> {
    return this.tasks.manager.transaction(async (em) => {
      const ctx = await this.load(em, user, sourceProjectId, taskId, dto.targetProjectId);
      const plan = this.plan(ctx);

      // 画面が選んだ値は、移動先のものかをここで確かめる（画面の値をそのまま信じない）
      const status = ctx.target.statuses.find((s) => s.code === dto.statusCode);
      if (!status) throw new BadRequestException('移動先のステータスを選んでください');
      const priority =
        dto.priorityCode == null
          ? null
          : ctx.target.priorities.find((p) => p.code === dto.priorityCode);
      if (dto.priorityCode != null && !priority) {
        throw new BadRequestException('移動先に無い優先度です');
      }
      const assignee = this.pickMember(ctx, dto.assigneeMemberId, '担当者');
      if (assignee && !this.assignable(assignee)) {
        throw new BadRequestException('閲覧専用ユーザーのメンバーは担当者にできません');
      }
      const requester = this.pickMember(ctx, dto.requesterMemberId, '依頼者');

      const task = ctx.task;
      const fromSeq = task.seq;
      const toSeq = await this.nextSeq(em, ctx.targetProject.id);
      const now = new Date();
      const wasTerminal = ctx.source.status?.isTerminal === true;

      task.projectId = ctx.targetProject.id;
      task.seq = toSeq;
      task.statusCode = status.code;
      task.priorityCode = priority?.code ?? null;
      task.assigneeMemberId = assignee?.id ?? null;
      task.requesterMemberId = requester?.id ?? null;
      // 移動先のステータスを設定し直す操作とみなす（新規作成時に作成時刻を入れるのと同じ）
      task.statusChangedAt = now;
      if (status.isTerminal) task.completedAt = now;
      else if (wasTerminal) task.completedAt = null;
      await em.getRepository(Task).save(task);

      // タグ・フラグ: 同じ名前のものに付け替え、無いものは外す
      await em.getRepository(TaskTag).delete({ taskId: task.id });
      if (plan.tags.length > 0) {
        await em
          .getRepository(TaskTag)
          .insert(plan.tags.map((t) => ({ taskId: task.id, tagId: t.id })));
      }
      await em.getRepository(TaskFlag).delete({ taskId: task.id });
      if (plan.flags.length > 0) {
        await em
          .getRepository(TaskFlag)
          .insert(plan.flags.map((f) => ({ taskId: task.id, flagId: f.id })));
      }

      // サブタスク: 一緒に移し、担当者・フラグは同じ規則で付け替える
      for (const s of ctx.subtasks) {
        const mapped = s.assigneeMemberId
          ? this.mapMember(ctx, ctx.source.membersById.get(s.assigneeMemberId), true)
          : null;
        await em
          .getRepository(Subtask)
          .update(
            { id: s.id },
            { projectId: ctx.targetProject.id, assigneeMemberId: mapped?.id ?? null },
          );
      }
      const subtaskIds = ctx.subtasks.map((s) => s.id);
      if (subtaskIds.length > 0) {
        await em.getRepository(SubtaskFlag).delete({ subtaskId: In(subtaskIds) });
        const rows = ctx.subtaskFlags.flatMap((sf) => {
          const to = plan.flagMap.get(sf.flagId);
          return to ? [{ subtaskId: sf.subtaskId, flagId: to.id }] : [];
        });
        if (rows.length > 0) await em.getRepository(SubtaskFlag).insert(rows);
      }

      // コメント: 一緒に移し、投稿者は移動先の同じユーザーに。いなければ空（画面では「不明」）
      for (const c of ctx.comments) {
        const mapped = c.authorMemberId
          ? this.mapMember(ctx, ctx.source.membersById.get(c.authorMemberId), false)
          : null;
        await em
          .getRepository(Comment)
          .update(
            { id: c.id },
            { projectId: ctx.targetProject.id, authorMemberId: mapped?.id ?? null },
          );
      }

      // 関連: 両端が同じプロジェクトである前提なので、移動元のタスクとの関連は切る
      await em.getRepository(TaskRelation).delete({ sourceTaskId: task.id });
      await em.getRepository(TaskRelation).delete({ targetTaskId: task.id });

      // 通知: プロジェクト＋番号でタスクへ飛ぶので、付け替えないと移動前の通知のリンクが壊れる
      await em
        .getRepository(Notification)
        .update({ taskId: task.id }, { projectId: ctx.targetProject.id, taskSeq: toSeq });

      await this.audit.record(
        {
          tenantId: user.tenantId,
          entityType: 'task',
          entityId: task.id,
          projectId: ctx.targetProject.id,
          action: 'update',
          changes: this.changes(
            ctx,
            fromSeq,
            toSeq,
            status,
            priority ?? null,
            assignee,
            requester,
            plan,
          ),
          actorUserId: user.userId,
        },
        em,
      );

      return {
        projectId: ctx.targetProject.id,
        id: task.id,
        seq: toSeq,
        shortCode: task.shortCode,
      };
    });
  }

  // ===== 内部 =====

  /** 移動元・移動先の必要なものをまとめて読む。権限と移動先の条件もここで確かめる */
  private async load(
    em: EntityManager,
    user: AuthenticatedUser,
    sourceProjectId: string,
    taskId: string,
    targetProjectId: string,
  ) {
    if (sourceProjectId === targetProjectId) {
      throw new BadRequestException('移動先には別のプロジェクトを選んでください');
    }
    const projects = em.getRepository(Project);
    const [sourceProject, targetProject] = await Promise.all([
      projects.findOne({ where: { id: sourceProjectId, tenantId: user.tenantId } }),
      projects.findOne({ where: { id: targetProjectId, tenantId: user.tenantId } }),
    ]);
    if (!sourceProject) throw new NotFoundException('プロジェクトが見つかりません');
    // 移動元も編集できる人に限る。POST はガードが確かめるが、事前確認（GET）は閲覧しか見ないため
    await this.access.assertEditor(user, sourceProject.id);
    // 移動先は見えなければ存在を伏せる（404）。見えても、メンバーでなければ動かせない（403）
    if (!targetProject) throw new NotFoundException('移動先のプロジェクトが見つかりません');
    await this.access.assertAccess(user, targetProject.id);
    await this.access.assertEditor(user, targetProject.id);
    if (targetProject.archivedAt) {
      throw new BadRequestException('アーカイブされたプロジェクトへは移動できません');
    }

    const task = await em
      .getRepository(Task)
      .findOne({ where: { id: taskId, projectId: sourceProjectId } });
    if (!task) throw new NotFoundException('タスクが見つかりません');

    const loadMasters = async (projectId: string) => {
      const [statuses, priorities, members, tags, flags] = await Promise.all([
        em.getRepository(TaskStatus).find({ where: { projectId }, order: { order: 'ASC' } }),
        em.getRepository(TaskPriority).find({ where: { projectId }, order: { order: 'ASC' } }),
        em.getRepository(ProjectMember).find({ where: { projectId }, relations: { user: true } }),
        em.getRepository(Tag).find({ where: { projectId } }),
        em.getRepository(Flag).find({ where: { projectId } }),
      ]);
      return { statuses, priorities, members, tags, flags };
    };
    const [sourceMasters, target] = await Promise.all([
      loadMasters(sourceProjectId),
      loadMasters(targetProject.id),
    ]);

    const [taskTags, taskFlags, subtasks, comments, relationCount] = await Promise.all([
      em.getRepository(TaskTag).find({ where: { taskId: task.id } }),
      em.getRepository(TaskFlag).find({ where: { taskId: task.id } }),
      em.getRepository(Subtask).find({ where: { taskId: task.id } }),
      em.getRepository(Comment).find({ where: { taskId: task.id } }),
      em
        .getRepository(TaskRelation)
        .count({ where: [{ sourceTaskId: task.id }, { targetTaskId: task.id }] }),
    ]);
    const subtaskFlags = subtasks.length
      ? await em
          .getRepository(SubtaskFlag)
          .find({ where: { subtaskId: In(subtasks.map((s) => s.id)) } })
      : [];

    const membersById = new Map(sourceMasters.members.map((m) => [m.id, m]));
    return {
      task,
      sourceProject,
      targetProject,
      target,
      source: {
        ...sourceMasters,
        membersById,
        status: sourceMasters.statuses.find((s) => s.code === task.statusCode) ?? null,
        priority: sourceMasters.priorities.find((p) => p.code === task.priorityCode) ?? null,
        assignee: task.assigneeMemberId ? (membersById.get(task.assigneeMemberId) ?? null) : null,
        requester: task.requesterMemberId
          ? (membersById.get(task.requesterMemberId) ?? null)
          : null,
        tagIds: taskTags.map((t) => t.tagId),
        flagIds: taskFlags.map((f) => f.flagId),
      },
      subtasks,
      subtaskFlags,
      comments,
      relationCount,
    };
  }

  /** 付け替えの規則。preview と move で共通 */
  private plan(ctx: Awaited<ReturnType<TaskMoveService['load']>>) {
    const { source, target } = ctx;
    const status =
      target.statuses.find((s) => sameName(s.label, source.status?.label)) ??
      target.statuses.find((s) => s.isInitial) ??
      target.statuses[0];
    if (!status) throw new BadRequestException('移動先にステータスがありません');
    const priority =
      target.priorities.find((p) => sameName(p.label, source.priority?.label)) ?? null;

    const byName = <T extends { id: string; name: string }>(from: T[], to: T[]) => {
      const map = new Map<string, T>();
      for (const f of from) {
        const hit = to.find((t) => sameName(t.name, f.name));
        if (hit) map.set(f.id, hit);
      }
      return map;
    };
    const tagMap = byName(source.tags, target.tags);
    const flagMap = byName(source.flags, target.flags);
    const tagsOfTask = source.tags.filter((t) => source.tagIds.includes(t.id));
    const flagsOfTask = source.flags.filter((f) => source.flagIds.includes(f.id));

    const flagName = new Map(source.flags.map((f) => [f.id, f.name]));
    const droppedSubtaskFlagNames = uniq(
      ctx.subtaskFlags
        .filter((sf) => !flagMap.has(sf.flagId))
        .map((sf) => flagName.get(sf.flagId) ?? ''),
    ).filter(Boolean);
    const droppedSubtaskAssigneeNames = uniq(
      ctx.subtasks
        .map((s) => (s.assigneeMemberId ? source.membersById.get(s.assigneeMemberId) : undefined))
        .filter((m): m is ProjectMember => !!m && !this.mapMember(ctx, m, true))
        .map((m) => m.displayName),
    );

    const unknown = new Map<string, number>();
    for (const c of ctx.comments) {
      const m = c.authorMemberId ? source.membersById.get(c.authorMemberId) : undefined;
      if (m && !this.mapMember(ctx, m, false)) {
        unknown.set(m.displayName, (unknown.get(m.displayName) ?? 0) + 1);
      }
    }

    return {
      statusCode: status.code,
      priorityCode: priority?.code ?? null,
      assigneeMemberId: this.mapMember(ctx, source.assignee ?? undefined, true)?.id ?? null,
      requesterMemberId: this.mapMember(ctx, source.requester ?? undefined, false)?.id ?? null,
      flagMap,
      tags: uniq(tagsOfTask.map((t) => tagMap.get(t.id)).filter((t): t is Tag => !!t)),
      flags: uniq(flagsOfTask.map((f) => flagMap.get(f.id)).filter((f): f is Flag => !!f)),
      droppedTagNames: tagsOfTask.filter((t) => !tagMap.has(t.id)).map((t) => t.name),
      droppedFlagNames: flagsOfTask.filter((f) => !flagMap.has(f.id)).map((f) => f.name),
      droppedSubtaskAssigneeNames,
      droppedSubtaskFlagNames,
      unknownAuthors: [...unknown].map(([name, count]) => ({ name, count })),
    };
  }

  /**
   * 移動元のメンバーに当たる、移動先のメンバー。同じユーザーに紐づくメンバー、
   * ユーザーの無い擬人化メンバーは同じ表示名で突き合わせる。担当者として使うなら readonly は除く。
   */
  private mapMember(
    ctx: Awaited<ReturnType<TaskMoveService['load']>>,
    m: ProjectMember | undefined,
    asAssignee: boolean,
  ): ProjectMember | null {
    if (!m) return null;
    const hit = m.userId
      ? ctx.target.members.find((t) => t.userId === m.userId)
      : ctx.target.members.find((t) => !t.userId && sameName(t.displayName, m.displayName));
    if (!hit) return null;
    if (asAssignee && !this.assignable(hit)) return null;
    return hit;
  }

  private assignable(m: ProjectMember): boolean {
    return m.user?.role !== 'readonly';
  }

  private pickMember(
    ctx: Awaited<ReturnType<TaskMoveService['load']>>,
    id: string | null | undefined,
    label: string,
  ): ProjectMember | null {
    if (id == null) return null;
    const m = ctx.target.members.find((x) => x.id === id);
    if (!m) throw new BadRequestException(`移動先のメンバーではない${label}です`);
    return m;
  }

  private async nextSeq(em: EntityManager, projectId: string): Promise<number> {
    const row = await em
      .getRepository(Task)
      .createQueryBuilder('t')
      .select('MAX(t.seq)', 'maxSeq')
      .where('t.project_id = :projectId', { projectId })
      .getRawOne<{ maxSeq: number | null }>();
    return Number(row?.maxSeq ?? 0) + 1;
  }

  /** 変更履歴。移動は update として「プロジェクト」「番号」と、付け替わった項目を記録する */
  private changes(
    ctx: Awaited<ReturnType<TaskMoveService['load']>>,
    fromSeq: number,
    toSeq: number,
    status: TaskStatus,
    priority: TaskPriority | null,
    assignee: ProjectMember | null,
    requester: ProjectMember | null,
    plan: ReturnType<TaskMoveService['plan']>,
  ): AuditChange[] {
    const { source } = ctx;
    const list: AuditChange[] = [
      {
        field: 'project',
        old: ctx.sourceProject.id,
        new: ctx.targetProject.id,
        oldLabel: ctx.sourceProject.name,
        newLabel: ctx.targetProject.name,
      },
      {
        field: 'seq',
        old: String(fromSeq),
        new: String(toSeq),
        oldLabel: `#${fromSeq}`,
        newLabel: `#${toSeq}`,
      },
    ];
    const push = (field: string, oldLabel: string | null, newLabel: string | null) => {
      if ((oldLabel ?? '') !== (newLabel ?? ''))
        list.push({ field, old: oldLabel, new: newLabel, oldLabel, newLabel });
    };
    push('status', source.status?.label ?? null, status.label);
    push('priority', source.priority?.label ?? null, priority?.label ?? null);
    // 担当者・依頼者は、同じユーザーに付け替えただけなら記録しない（表示名が違っても同じ人のため）
    const pushMember = (field: string, from: ProjectMember | null, to: ProjectMember | null) => {
      if (from?.userId && from.userId === to?.userId) return;
      push(field, from?.displayName ?? null, to?.displayName ?? null);
    };
    pushMember('assignee', source.assignee ?? null, assignee);
    pushMember('requester', source.requester ?? null, requester);
    const join = (xs: string[]) => (xs.length ? xs.join(', ') : null);
    const oldTags = source.tags.filter((t) => source.tagIds.includes(t.id)).map((t) => t.name);
    const oldFlags = source.flags.filter((f) => source.flagIds.includes(f.id)).map((f) => f.name);
    push('tags', join(oldTags), join(plan.tags.map((t) => t.name)));
    push('flags', join(oldFlags), join(plan.flags.map((f) => f.name)));
    return list;
  }
}
