import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Observable, Subject } from 'rxjs';
import { In, IsNull, Repository } from 'typeorm';
import type { AuditChange } from '../audit/audit-log.entity';
import { ProjectMember } from '../members/member.entity';
import type { Task } from '../tasks/task.entity';
import { NotificationPreference } from './notification-preference.entity';
import {
  NOTIFICATION_TYPES,
  isNotificationType,
  type NotificationType,
} from './notification-types';
import { Notification } from './notification.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  /** 受信者ごとのリアルタイム配信ストリーム（in-memory・単一インスタンス前提） */
  private readonly streams = new Map<string, Subject<Notification>>();

  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly prefs: Repository<NotificationPreference>,
    @InjectRepository(ProjectMember)
    private readonly members: Repository<ProjectMember>,
  ) {}

  // ===== 取得・既読 =====

  listForUser(tenantId: string, userId: string, limit = 30): Promise<Notification[]> {
    return this.notifications.find({
      where: { tenantId, userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  unreadCount(tenantId: string, userId: string): Promise<number> {
    return this.notifications.count({ where: { tenantId, userId, readAt: IsNull() } });
  }

  async markRead(tenantId: string, userId: string, id: string): Promise<void> {
    await this.notifications.update({ id, tenantId, userId }, { readAt: new Date() });
  }

  async markAllRead(tenantId: string, userId: string): Promise<void> {
    await this.notifications.update({ tenantId, userId, readAt: IsNull() }, { readAt: new Date() });
  }

  // ===== 設定（マイページ通知タブ） =====

  /** 全タイプの設定を返す（未設定は既定値）。 */
  async getPreferences(
    userId: string,
  ): Promise<{ type: NotificationType; label: string; enabled: boolean }[]> {
    const rows = await this.prefs.find({ where: { userId } });
    const map = new Map(rows.map((r) => [r.type, r.enabled]));
    return NOTIFICATION_TYPES.map((t) => ({
      type: t.key,
      label: t.label,
      enabled: map.get(t.key) ?? t.defaultEnabled,
    }));
  }

  async setPreference(
    userId: string,
    type: string,
    enabled: boolean,
  ): Promise<{ type: NotificationType; label: string; enabled: boolean }[]> {
    if (!isNotificationType(type)) throw new BadRequestException('不明な通知タイプです');
    const existing = await this.prefs.findOne({ where: { userId, type } });
    if (existing) {
      existing.enabled = enabled;
      await this.prefs.save(existing);
    } else {
      await this.prefs.save(this.prefs.create({ userId, type, enabled }));
    }
    return this.getPreferences(userId);
  }

  // ===== リアルタイム配信（SSE 用） =====

  /** 受信者のストリームを購読する。SSE エンドポイントが使用。 */
  stream(userId: string): Observable<Notification> {
    let s = this.streams.get(userId);
    if (!s) {
      s = new Subject<Notification>();
      this.streams.set(userId, s);
    }
    return s.asObservable();
  }

  private push(n: Notification): void {
    this.streams.get(n.userId)?.next(n);
  }

  // ===== 生成フック（タスク操作後にベストエフォートで呼ぶ。失敗しても本処理は壊さない） =====

  /** 新規タスク作成時。担当者には assigned、他のメンバーには task_created。 */
  async onTaskCreated(tenantId: string, task: Task, actorUserId: string): Promise<void> {
    try {
      const assigneeUserId = await this.resolveMemberUserId(task.assigneeMemberId);
      const memberUserIds = await this.projectMemberUserIds(task.projectId);

      const assignedTo = assigneeUserId && assigneeUserId !== actorUserId ? [assigneeUserId] : [];
      const createdTo = memberUserIds.filter((u) => u !== actorUserId && u !== assigneeUserId);

      await this.emit(
        tenantId,
        'assigned',
        assignedTo,
        task,
        actorUserId,
        this.assignedMessage(task),
      );
      await this.emit(
        tenantId,
        'task_created',
        createdTo,
        task,
        actorUserId,
        this.createdMessage(task),
      );
    } catch (e) {
      this.logger.error(`onTaskCreated failed for task ${task.id}`, e as Error);
    }
  }

  /** タスク更新時。担当者変更→assigned、ステータス変更→status_changed（担当＋起票）。 */
  async onTaskChanged(
    tenantId: string,
    task: Task,
    changes: AuditChange[],
    actorUserId: string,
  ): Promise<void> {
    try {
      if (changes.some((c) => c.field === 'assignee')) {
        const newAssignee = await this.resolveMemberUserId(task.assigneeMemberId);
        if (newAssignee && newAssignee !== actorUserId) {
          await this.emit(
            tenantId,
            'assigned',
            [newAssignee],
            task,
            actorUserId,
            this.assignedMessage(task),
          );
        }
      }
      const statusChange = changes.find((c) => c.field === 'status');
      if (statusChange) {
        const assignee = await this.resolveMemberUserId(task.assigneeMemberId);
        const requester = await this.resolveMemberUserId(task.requesterMemberId);
        const recipients = [...new Set([assignee, requester])].filter(
          (u): u is string => Boolean(u) && u !== actorUserId,
        );
        await this.emit(
          tenantId,
          'status_changed',
          recipients,
          task,
          actorUserId,
          this.statusMessage(task, statusChange.newLabel ?? statusChange.new ?? ''),
        );
      }
    } catch (e) {
      this.logger.error(`onTaskChanged failed for task ${task.id}`, e as Error);
    }
  }

  /** コメントで @メンションされたユーザーへ通知する（操作者＝コメント投稿者は除外）。 */
  async onCommentMentioned(
    tenantId: string,
    task: Task,
    mentionedUserIds: string[],
    actorUserId: string,
  ): Promise<void> {
    try {
      const recipients = [...new Set(mentionedUserIds)].filter((u) => u && u !== actorUserId);
      if (recipients.length === 0) return;
      await this.emit(
        tenantId,
        'mentioned',
        recipients,
        task,
        actorUserId,
        this.mentionMessage(task),
      );
    } catch (e) {
      this.logger.error(`onCommentMentioned failed for task ${task.id}`, e as Error);
    }
  }

  /** 指定タイプを、設定 OFF を除いた受信者へ作成・配信する。 */
  private async emit(
    tenantId: string,
    type: NotificationType,
    userIds: string[],
    task: Task,
    actorUserId: string,
    message: string,
  ): Promise<void> {
    const recipients = await this.filterByPreference(userIds, type);
    for (const userId of recipients) {
      const n = await this.notifications.save(
        this.notifications.create({
          tenantId,
          userId,
          type,
          projectId: task.projectId,
          taskId: task.id,
          taskSeq: task.seq,
          actorUserId,
          message,
          readAt: null,
        }),
      );
      this.push(n);
    }
  }

  /** 既定 ON。明示的に無効化したユーザーだけ除外する。 */
  private async filterByPreference(userIds: string[], type: NotificationType): Promise<string[]> {
    if (userIds.length === 0) return [];
    const disabled = await this.prefs.find({
      where: { userId: In(userIds), type, enabled: false },
    });
    const disabledSet = new Set(disabled.map((d) => d.userId));
    return userIds.filter((u) => !disabledSet.has(u));
  }

  private async resolveMemberUserId(memberId: string | null): Promise<string | null> {
    if (!memberId) return null;
    const m = await this.members.findOne({ where: { id: memberId } });
    return m?.userId ?? null;
  }

  private async projectMemberUserIds(projectId: string): Promise<string[]> {
    const ms = await this.members.find({ where: { projectId } });
    return ms.map((m) => m.userId).filter((u): u is string => Boolean(u));
  }

  private shortContent(task: Task): string {
    return task.content.length > 40 ? `${task.content.slice(0, 40)}…` : task.content;
  }
  private createdMessage(task: Task): string {
    return `新しいタスク #${task.seq}「${this.shortContent(task)}」が登録されました`;
  }
  private assignedMessage(task: Task): string {
    return `タスク #${task.seq}「${this.shortContent(task)}」の担当に設定されました`;
  }
  private statusMessage(task: Task, statusLabel: string): string {
    return `タスク #${task.seq}「${this.shortContent(task)}」のステータスが「${statusLabel}」に変わりました`;
  }
  private mentionMessage(task: Task): string {
    return `タスク #${task.seq}「${this.shortContent(task)}」のコメントでメンションされました`;
  }
}
