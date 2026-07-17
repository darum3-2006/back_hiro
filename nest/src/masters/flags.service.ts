import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
import { ProjectsService } from '../projects/projects.service';
import { SubtaskFlag } from '../subtasks/subtask-flag.entity';
import { TaskFlag } from '../tasks/task-flag.entity';
import { CreateFlagDto } from './dto/create-flag.dto';
import { UpdateFlagDto } from './dto/update-flag.dto';
import { Flag } from './flag.entity';
import { generateMasterCode } from './ordered-master.helpers';

@Injectable()
export class FlagsService {
  constructor(
    @InjectRepository(Flag)
    private readonly flags: Repository<Flag>,
    @InjectRepository(TaskFlag)
    private readonly taskFlags: Repository<TaskFlag>,
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
  ) {}

  async listByProject(tenantId: string, projectId: string): Promise<Flag[]> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    return this.flags.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    });
  }

  async create(tenantId: string, projectId: string, dto: CreateFlagDto): Promise<Flag> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const flag = this.flags.create({
      projectId,
      code: generateMasterCode('f'),
      name: dto.name.trim(),
      color: dto.color,
    });
    return this.flags.save(flag);
  }

  async update(
    tenantId: string,
    projectId: string,
    code: string,
    dto: UpdateFlagDto,
  ): Promise<Flag> {
    const flag = await this.findInProject(tenantId, projectId, code);
    if (dto.name !== undefined) flag.name = dto.name.trim();
    if (dto.color !== undefined) flag.color = dto.color;
    return this.flags.save(flag);
  }

  async remove(tenantId: string, projectId: string, code: string): Promise<void> {
    const flag = await this.findInProject(tenantId, projectId, code);
    try {
      await this.flags.remove(flag);
    } catch (e) {
      if (this.isFkViolation(e)) {
        throw new ConflictException('参照されているため削除できません');
      }
      throw e;
    }
  }

  /**
   * このフラグを全タスク・全サブタスクから外す（フラグ定義自体は残す）。
   * 影響したタスク各々の履歴にフラグ変更を記録する
   * （サブタスクのフラグ変更は履歴に残さない既存の作法に合わせる）。
   */
  async detachFromAllTasks(
    tenantId: string,
    projectId: string,
    actorUserId: string,
    code: string,
  ): Promise<void> {
    const flag = await this.findInProject(tenantId, projectId, code);
    await this.taskFlags.manager.transaction(async (em) => {
      const before = await this.flagSetsForTasksWithFlag(em, flag.id);
      await em.delete(TaskFlag, { flagId: flag.id });
      await em.delete(SubtaskFlag, { flagId: flag.id });
      const nameByCode = await this.flagNameMap(em, projectId);
      await this.recordFlagSetChanges(
        tenantId,
        projectId,
        actorUserId,
        before,
        (codes) => codes.filter((c) => c !== flag.code),
        nameByCode,
        em,
      );
    });
  }

  /**
   * コピー: source フラグが付いた全タスク・全サブタスクに target フラグを追加する（source は残す）。
   * 既に target が付いている場合は INSERT IGNORE で重複を無視。影響タスクの履歴に記録。
   */
  async copyToFlag(
    tenantId: string,
    projectId: string,
    actorUserId: string,
    sourceCode: string,
    targetCode: string,
  ): Promise<void> {
    const { source, target } = await this.resolvePair(tenantId, projectId, sourceCode, targetCode);
    await this.taskFlags.manager.transaction(async (em) => {
      const before = await this.flagSetsForTasksWithFlag(em, source.id);
      await em.query(
        `INSERT IGNORE INTO task_flags (task_id, flag_id)
         SELECT tf.task_id, ? FROM task_flags tf WHERE tf.flag_id = ?`,
        [target.id, source.id],
      );
      await em.query(
        `INSERT IGNORE INTO subtask_flags (subtask_id, flag_id)
         SELECT sf.subtask_id, ? FROM subtask_flags sf WHERE sf.flag_id = ?`,
        [target.id, source.id],
      );
      const nameByCode = await this.flagNameMap(em, projectId);
      await this.recordFlagSetChanges(
        tenantId,
        projectId,
        actorUserId,
        before,
        (codes) => (codes.includes(target.code) ? codes : [...codes, target.code]),
        nameByCode,
        em,
      );
    });
  }

  /**
   * 移動: source フラグが付いた全タスク・全サブタスクに target を付与し、source を外す。
   * 追加 → 削除 → 履歴記録を 1 トランザクションで行う。
   */
  async moveToFlag(
    tenantId: string,
    projectId: string,
    actorUserId: string,
    sourceCode: string,
    targetCode: string,
  ): Promise<void> {
    const { source, target } = await this.resolvePair(tenantId, projectId, sourceCode, targetCode);
    await this.taskFlags.manager.transaction(async (em) => {
      const before = await this.flagSetsForTasksWithFlag(em, source.id);
      await em.query(
        `INSERT IGNORE INTO task_flags (task_id, flag_id)
         SELECT tf.task_id, ? FROM task_flags tf WHERE tf.flag_id = ?`,
        [target.id, source.id],
      );
      await em.query(
        `INSERT IGNORE INTO subtask_flags (subtask_id, flag_id)
         SELECT sf.subtask_id, ? FROM subtask_flags sf WHERE sf.flag_id = ?`,
        [target.id, source.id],
      );
      await em.delete(TaskFlag, { flagId: source.id });
      await em.delete(SubtaskFlag, { flagId: source.id });
      const nameByCode = await this.flagNameMap(em, projectId);
      await this.recordFlagSetChanges(
        tenantId,
        projectId,
        actorUserId,
        before,
        (codes) => {
          const without = codes.filter((c) => c !== source.code);
          return without.includes(target.code) ? without : [...without, target.code];
        },
        nameByCode,
        em,
      );
    });
  }

  /** source フラグが付いた各タスクの「全フラグコード集合」を返す（変更前スナップショット用）。 */
  private async flagSetsForTasksWithFlag(
    em: EntityManager,
    sourceFlagId: string,
  ): Promise<Map<string, string[]>> {
    const rows = await em.query<{ taskId: string; code: string }[]>(
      `SELECT tf.task_id AS taskId, fl.code AS code
       FROM task_flags tf
       INNER JOIN flags fl ON fl.id = tf.flag_id
       WHERE tf.task_id IN (SELECT task_id FROM task_flags WHERE flag_id = ?)`,
      [sourceFlagId],
    );
    const map = new Map<string, string[]>();
    for (const r of rows) {
      const arr = map.get(r.taskId) ?? [];
      arr.push(r.code);
      map.set(r.taskId, arr);
    }
    return map;
  }

  /** プロジェクト内フラグの code → name マップ（履歴のラベル用）。 */
  private async flagNameMap(em: EntityManager, projectId: string): Promise<Map<string, string>> {
    const rows = await em.query<{ code: string; name: string }[]>(
      `SELECT code, name FROM flags WHERE project_id = ?`,
      [projectId],
    );
    return new Map(rows.map((r) => [r.code, r.name]));
  }

  /** 変更前後のフラグ集合の差分を、影響タスク各々の監査ログに記録する。 */
  private async recordFlagSetChanges(
    tenantId: string,
    projectId: string,
    actorUserId: string,
    before: Map<string, string[]>,
    computeAfter: (codes: string[]) => string[],
    nameByCode: Map<string, string>,
    em: EntityManager,
  ): Promise<void> {
    const sortedKey = (cs: string[]) => [...cs].sort().join(' ');
    const joinNames = (cs: string[]) => cs.map((c) => nameByCode.get(c) ?? c).join(', ');
    for (const [taskId, beforeCodes] of before) {
      const afterCodes = computeAfter(beforeCodes);
      if (sortedKey(beforeCodes) === sortedKey(afterCodes)) continue;
      await this.audit.record(
        {
          tenantId,
          entityType: 'task',
          entityId: taskId,
          projectId,
          action: 'update',
          changes: [
            {
              field: 'flags',
              old: beforeCodes.join(','),
              new: afterCodes.join(','),
              oldLabel: joinNames(beforeCodes),
              newLabel: joinNames(afterCodes),
            },
          ],
          actorUserId,
        },
        em,
      );
    }
  }

  /** source / target フラグを解決する（同一指定は弾く）。 */
  private async resolvePair(
    tenantId: string,
    projectId: string,
    sourceCode: string,
    targetCode: string,
  ): Promise<{ source: Flag; target: Flag }> {
    if (sourceCode === targetCode) {
      throw new BadRequestException('コピー / 移動元と先に同じフラグは指定できません');
    }
    const source = await this.findInProject(tenantId, projectId, sourceCode);
    const target = await this.findInProject(tenantId, projectId, targetCode);
    return { source, target };
  }

  private async findInProject(tenantId: string, projectId: string, code: string): Promise<Flag> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const flag = await this.flags.findOne({ where: { projectId, code } });
    if (!flag) throw new NotFoundException('フラグが見つかりません');
    return flag;
  }

  private isFkViolation(e: unknown): boolean {
    return (
      e instanceof QueryFailedError &&
      (e as QueryFailedError & { driverError?: { code?: string } }).driverError?.code ===
        'ER_ROW_IS_REFERENCED_2'
    );
  }
}
