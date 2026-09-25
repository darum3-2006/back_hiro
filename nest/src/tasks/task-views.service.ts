import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TaskStatus } from '../masters/task-status.entity';
import { ProjectsService } from '../projects/projects.service';
import { TASK_VIEW_HISTORY_LIMIT, TaskView } from './task-view.entity';
import { Task } from './task.entity';

/** 閲覧履歴 1 件の返却形（プロジェクト横断なので projectId / projectName を含む） */
export interface TaskViewResponse {
  shortCode: string;
  seq: number;
  content: string;
  statusLabel: string;
  statusColor: string;
  projectId: string;
  projectName: string;
  viewedAt: Date;
}

@Injectable()
export class TaskViewsService {
  constructor(
    @InjectRepository(TaskView)
    private readonly views: Repository<TaskView>,
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    private readonly projects: ProjectsService,
  ) {}

  /**
   * タスクを開いたことを記録する。同じタスクなら日時だけ更新して先頭に戻す。
   * 記録のたびに古い分を消すので、1 ユーザーの行数は TASK_VIEW_HISTORY_LIMIT で頭打ちになる。
   */
  async record(tenantId: string, userId: string, projectId: string, taskId: string) {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const task = await this.tasks.findOne({ where: { projectId, id: taskId }, select: ['id'] });
    if (!task) throw new NotFoundException('タスクが見つかりません');

    await this.views.upsert(
      { tenantId, userId, taskId, viewedAt: new Date() },
      { conflictPaths: ['userId', 'taskId'] },
    );

    // 上限を超えた古い分を消す。MySQL は同じテーブルを参照する DELETE … LIMIT を
    // サブクエリで書けないので、消す ID を先に引いてから消す。
    // MySQL は LIMIT なしの OFFSET を受け付けないので take も付ける。記録のたびに削るので
    // 超過は通常 1 件だが、上限を下げたときなどにも一度で片付くよう余裕を持たせる
    const stale = await this.views.find({
      where: { userId },
      order: { viewedAt: 'DESC' },
      skip: TASK_VIEW_HISTORY_LIMIT,
      take: 1000,
      select: ['id'],
    });
    if (stale.length > 0) await this.views.delete({ id: In(stale.map((v) => v.id)) });
  }

  /**
   * 自分の閲覧履歴を新しい順に返す（プロジェクト横断）。
   * 閲覧権が外れたプロジェクト・アーカイブ済みプロジェクト・削除済みタスクは、
   * 記録が残っていても読み出し時に除く（見られなくなったタスクの名前を出さないため）。
   */
  async listMine(
    tenantId: string,
    userId: string,
    accessibleProjectIds: string[] | null,
  ): Promise<TaskViewResponse[]> {
    if (accessibleProjectIds !== null && accessibleProjectIds.length === 0) return [];
    const rows = await this.views
      .createQueryBuilder('v')
      .innerJoin(Task, 't', 't.id = v.task_id AND t.deleted_at IS NULL')
      .innerJoin('t.project', 'p')
      .innerJoin(TaskStatus, 's', 's.project_id = t.project_id AND s.code = t.status_code')
      .where('v.tenant_id = :tenantId', { tenantId })
      .andWhere('v.user_id = :userId', { userId })
      .andWhere('p.tenant_id = :tenantId', { tenantId })
      .andWhere('p.archived_at IS NULL')
      .andWhere(
        accessibleProjectIds === null ? '1 = 1' : 't.project_id IN (:...accessibleProjectIds)',
        accessibleProjectIds === null ? {} : { accessibleProjectIds },
      )
      .orderBy('v.viewed_at', 'DESC')
      .select([
        't.short_code AS shortCode',
        't.seq AS seq',
        't.content AS content',
        's.label AS statusLabel',
        's.color AS statusColor',
        't.project_id AS projectId',
        'p.name AS projectName',
        'v.viewed_at AS viewedAt',
      ])
      .limit(TASK_VIEW_HISTORY_LIMIT)
      .getRawMany<TaskViewResponse>();
    return rows.map((r) => ({ ...r, seq: Number(r.seq) }));
  }
}
