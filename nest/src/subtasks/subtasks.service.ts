import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { TaskStatus } from '../masters/task-status.entity';
import { ProjectMember } from '../members/member.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ProjectsService } from '../projects/projects.service';
import { SlackService } from '../slack/slack.service';
import { Task } from '../tasks/task.entity';
import { CreateSubtaskDto } from './dto/create-subtask.dto';
import { ReorderSubtasksDto } from './dto/reorder-subtasks.dto';
import { UpdateSubtaskDto } from './dto/update-subtask.dto';
import { Subtask } from './subtask.entity';

/** 一覧（案X）用: サブタスク＋親タスクの seq / content を添えた行。 */
export interface SubtaskRowResponse extends Subtask {
  parentSeq: number;
  parentContent: string;
  /** 親タスクの期限（子が超過していたら一覧で警告する） */
  parentDeadline: string | null;
}

@Injectable()
export class SubtasksService {
  constructor(
    @InjectRepository(Subtask)
    private readonly subtasks: Repository<Subtask>,
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    @InjectRepository(ProjectMember)
    private readonly members: Repository<ProjectMember>,
    @InjectRepository(TaskStatus)
    private readonly statuses: Repository<TaskStatus>,
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
    private readonly slack: SlackService,
    private readonly notifications: NotificationsService,
  ) {}

  async listByTask(tenantId: string, projectId: string, taskId: string): Promise<Subtask[]> {
    await this.assertTaskInProject(tenantId, projectId, taskId);
    return this.subtasks.find({ where: { taskId }, order: { position: 'ASC' } });
  }

  /** プロジェクト内の全サブタスクを、親タスクの seq / content 付きで返す（一覧の子行用）。 */
  async listByProject(tenantId: string, projectId: string): Promise<SubtaskRowResponse[]> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const subs = await this.subtasks.find({
      where: { projectId },
      order: { taskId: 'ASC', position: 'ASC' },
    });
    if (subs.length === 0) return [];
    const taskIds = [...new Set(subs.map((s) => s.taskId))];
    const tasks = await this.tasks.find({
      where: { id: In(taskIds) },
      select: { id: true, seq: true, content: true, deadline: true },
    });
    const map = new Map(tasks.map((t) => [t.id, t]));
    return subs.map((s) => ({
      ...s,
      parentSeq: map.get(s.taskId)?.seq ?? 0,
      parentContent: map.get(s.taskId)?.content ?? '',
      parentDeadline: map.get(s.taskId)?.deadline ?? null,
    }));
  }

  async create(
    tenantId: string,
    projectId: string,
    taskId: string,
    dto: CreateSubtaskDto,
    actingUserId: string,
  ): Promise<Subtask> {
    const task = await this.assertTaskInProject(tenantId, projectId, taskId);
    // 不変条件: 親が終端（完了扱い）の間は未完了の子を増やせない
    if (await this.isTerminal(projectId, task.statusCode)) {
      throw new BadRequestException(
        '完了しているタスクにはサブタスクを追加できません。先に親のステータスを戻してください',
      );
    }
    if (dto.assigneeMemberId) await this.assertMemberInProject(projectId, dto.assigneeMemberId);

    const done = dto.done ?? false;
    const subtask = this.subtasks.create({
      projectId,
      taskId,
      title: dto.title.trim(),
      assigneeMemberId: dto.assigneeMemberId ?? null,
      deadline: dto.deadline ?? null,
      memo: dto.memo?.trim() ? dto.memo : null,
      done,
      completedAt: done ? new Date() : null,
      position: await this.nextPosition(taskId),
    });
    const saved = await this.subtasks.manager.transaction(async (em) => {
      const s = await em.getRepository(Subtask).save(subtask);
      await this.recordAudit(
        em,
        tenantId,
        projectId,
        taskId,
        'subtask_added',
        s.title,
        actingUserId,
      );
      return s;
    });
    // 通知はトランザクション外でベストエフォート（失敗しても作成は成立させる）
    await this.slack.notifySubtaskAdded(tenantId, task, saved.title);
    if (saved.assigneeMemberId) {
      await this.notifications.onSubtaskAssigned(
        tenantId,
        task,
        saved.title,
        saved.assigneeMemberId,
        actingUserId,
      );
    }
    return saved;
  }

  async update(
    tenantId: string,
    projectId: string,
    taskId: string,
    id: string,
    dto: UpdateSubtaskDto,
    actingUserId: string,
  ): Promise<Subtask> {
    const task = await this.assertTaskInProject(tenantId, projectId, taskId);
    const subtask = await this.findInTask(taskId, id);
    const prevAssignee = subtask.assigneeMemberId;

    if (dto.title !== undefined) subtask.title = dto.title.trim();
    if (dto.deadline !== undefined) subtask.deadline = dto.deadline ?? null;
    if (dto.memo !== undefined) subtask.memo = dto.memo?.trim() ? dto.memo : null;
    if (dto.assigneeMemberId !== undefined) {
      if (dto.assigneeMemberId) await this.assertMemberInProject(projectId, dto.assigneeMemberId);
      subtask.assigneeMemberId = dto.assigneeMemberId ?? null;
    }
    // 担当が新しい非 null 値に変わったか（アサイン通知の判定）
    const assigneeAssigned =
      subtask.assigneeMemberId !== null && subtask.assigneeMemberId !== prevAssignee;
    // 完了/未完了の切替のみ履歴に残す（タイトル・担当・期限・メモの編集は残さない）
    const doneChanged = dto.done !== undefined && dto.done !== subtask.done;
    if (doneChanged) {
      // 親が終端の間は子の完了解除を許さない（不変条件の維持。親を先に戻す運用）
      if (!dto.done && (await this.isTerminal(projectId, task.statusCode))) {
        throw new BadRequestException(
          '完了しているタスクのサブタスクは未完了に戻せません。先に親のステータスを戻してください',
        );
      }
      subtask.done = dto.done!;
      subtask.completedAt = dto.done ? new Date() : null;
    }
    const saved = await this.subtasks.manager.transaction(async (em) => {
      const s = await em.getRepository(Subtask).save(subtask);
      if (doneChanged) {
        await this.recordAudit(
          em,
          tenantId,
          projectId,
          taskId,
          s.done ? 'subtask_completed' : 'subtask_reopened',
          s.title,
          actingUserId,
        );
      }
      return s;
    });
    // 通知はトランザクション外でベストエフォート
    if (doneChanged && saved.done) {
      await this.slack.notifySubtaskCompleted(tenantId, task, saved.title);
    }
    if (assigneeAssigned) {
      await this.notifications.onSubtaskAssigned(
        tenantId,
        task,
        saved.title,
        saved.assigneeMemberId,
        actingUserId,
      );
    }
    return saved;
  }

  async remove(
    tenantId: string,
    projectId: string,
    taskId: string,
    id: string,
    actingUserId: string,
  ): Promise<void> {
    await this.assertTaskInProject(tenantId, projectId, taskId);
    const subtask = await this.findInTask(taskId, id);
    await this.subtasks.manager.transaction(async (em) => {
      await em.getRepository(Subtask).remove(subtask);
      await this.recordAudit(
        em,
        tenantId,
        projectId,
        taskId,
        'subtask_deleted',
        subtask.title,
        actingUserId,
      );
    });
  }

  /** 並び替え。指定 id 集合が当該タスクのサブタスク全件と一致することを要求する。 */
  async reorder(
    tenantId: string,
    projectId: string,
    taskId: string,
    dto: ReorderSubtasksDto,
  ): Promise<Subtask[]> {
    await this.assertTaskInProject(tenantId, projectId, taskId);
    const current = await this.subtasks.find({ where: { taskId } });
    const currentIds = new Set(current.map((s) => s.id));
    const givenIds = new Set(dto.ids);
    if (currentIds.size !== givenIds.size || dto.ids.some((id) => !currentIds.has(id))) {
      throw new BadRequestException('並び替え対象がこのタスクのサブタスクと一致しません');
    }
    await this.subtasks.manager.transaction(async (em) => {
      const repo = em.getRepository(Subtask);
      for (let i = 0; i < dto.ids.length; i++) {
        await repo.update({ id: dto.ids[i] }, { position: i });
      }
    });
    return this.subtasks.find({ where: { taskId }, order: { position: 'ASC' } });
  }

  // ===== 内部ヘルパ =====

  private async assertTaskInProject(
    tenantId: string,
    projectId: string,
    taskId: string,
  ): Promise<Task> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const task = await this.tasks.findOne({ where: { projectId, id: taskId } });
    if (!task) throw new NotFoundException('タスクが見つかりません');
    return task;
  }

  private async findInTask(taskId: string, id: string): Promise<Subtask> {
    const subtask = await this.subtasks.findOne({ where: { taskId, id } });
    if (!subtask) throw new NotFoundException('サブタスクが見つかりません');
    return subtask;
  }

  /**
   * サブタスクの操作を親タスクの監査ログに記録する（案B: 親の変更履歴に相乗り）。
   * field は subtask_added / subtask_completed / subtask_reopened / subtask_deleted。
   * 削除はタイトルを old に、その他は new に載せる（フロントの describeAuditChange が整形）。
   */
  private async recordAudit(
    em: EntityManager,
    tenantId: string,
    projectId: string,
    taskId: string,
    field: 'subtask_added' | 'subtask_completed' | 'subtask_reopened' | 'subtask_deleted',
    title: string,
    actorUserId: string,
  ): Promise<void> {
    const isDelete = field === 'subtask_deleted';
    await this.audit.record(
      {
        tenantId,
        entityType: 'task',
        entityId: taskId,
        projectId,
        action: 'update',
        changes: [
          {
            field,
            old: isDelete ? title : null,
            new: isDelete ? null : title,
            oldLabel: null,
            newLabel: null,
          },
        ],
        actorUserId,
      },
      em,
    );
  }

  private async assertMemberInProject(projectId: string, memberId: string): Promise<void> {
    const member = await this.members.findOne({ where: { projectId, id: memberId } });
    if (!member) {
      throw new BadRequestException('指定されたメンバーはこのプロジェクトに存在しません');
    }
  }

  private async isTerminal(projectId: string, statusCode: string): Promise<boolean> {
    const s = await this.statuses.findOne({ where: { projectId, code: statusCode } });
    return s?.isTerminal === true;
  }

  private async nextPosition(taskId: string): Promise<number> {
    const row = await this.subtasks
      .createQueryBuilder('s')
      .select('MAX(s.position)', 'maxPos')
      .where('s.task_id = :taskId', { taskId })
      .getRawOne<{ maxPos: number | null }>();
    return (row?.maxPos ?? -1) + 1;
  }
}
