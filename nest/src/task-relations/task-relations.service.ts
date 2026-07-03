import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProjectsService } from '../projects/projects.service';
import { Task } from '../tasks/task.entity';
import { CreateTaskRelationDto, RelationKind } from './dto/create-task-relation.dto';
import { TaskRelation, TaskRelationType } from './task-relation.entity';

/** タスク詳細用: 起点タスクから見た 1 件の関連。 */
export interface TaskRelationView {
  id: string;
  kind: RelationKind;
  otherTaskId: string;
  otherSeq: number;
  otherContent: string;
  otherStatusCode: string;
}

/** ガント用: プロジェクト内の有向エッジ。 */
export interface TaskRelationEdge {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  type: TaskRelationType;
}

@Injectable()
export class TaskRelationsService {
  constructor(
    @InjectRepository(TaskRelation)
    private readonly relations: Repository<TaskRelation>,
    @InjectRepository(Task)
    private readonly tasks: Repository<Task>,
    private readonly projects: ProjectsService,
  ) {}

  /** 起点タスクから見た関連一覧（両方向）。相手タスクの seq / content / status を添える。 */
  async listForTask(
    tenantId: string,
    projectId: string,
    taskId: string,
  ): Promise<TaskRelationView[]> {
    await this.assertTaskInProject(tenantId, projectId, taskId);
    const rows = await this.relations.find({
      where: [{ sourceTaskId: taskId }, { targetTaskId: taskId }],
      order: { createdAt: 'ASC' },
    });
    if (rows.length === 0) return [];
    const otherIds = [
      ...new Set(rows.map((r) => (r.sourceTaskId === taskId ? r.targetTaskId : r.sourceTaskId))),
    ];
    const others = await this.tasks.find({
      where: { id: In(otherIds) },
      select: { id: true, seq: true, content: true, statusCode: true },
    });
    const map = new Map(others.map((t) => [t.id, t]));
    return rows
      .map((r) => {
        const { kind, otherId } = this.viewFor(taskId, r);
        const other = map.get(otherId);
        if (!other) return null;
        return {
          id: r.id,
          kind,
          otherTaskId: other.id,
          otherSeq: other.seq,
          otherContent: other.content,
          otherStatusCode: other.statusCode,
        };
      })
      .filter((v): v is TaskRelationView => v !== null);
  }

  /** プロジェクト内の全関連（ガントのハイライト/依存違反用）。 */
  async listByProject(tenantId: string, projectId: string): Promise<TaskRelationEdge[]> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const rows = await this.relations.find({ where: { projectId } });
    return rows.map((r) => ({
      id: r.id,
      sourceTaskId: r.sourceTaskId,
      targetTaskId: r.targetTaskId,
      type: r.type,
    }));
  }

  async create(
    tenantId: string,
    projectId: string,
    taskId: string,
    dto: CreateTaskRelationDto,
  ): Promise<TaskRelationView> {
    await this.assertTaskInProject(tenantId, projectId, taskId);
    if (dto.otherTaskId === taskId) {
      throw new BadRequestException('同じタスク同士は関連づけできません');
    }
    await this.assertTaskInProject(tenantId, projectId, dto.otherTaskId);

    const { sourceTaskId, targetTaskId, type } = this.normalize(taskId, dto.otherTaskId, dto.kind);
    await this.assertNotDuplicate(sourceTaskId, targetTaskId, type);

    const saved = await this.relations.save(
      this.relations.create({ projectId, sourceTaskId, targetTaskId, type }),
    );
    const [view] = await this.buildViews(taskId, [saved]);
    return view;
  }

  async remove(tenantId: string, projectId: string, taskId: string, id: string): Promise<void> {
    await this.assertTaskInProject(tenantId, projectId, taskId);
    const rel = await this.relations.findOne({ where: { id, projectId } });
    // 起点タスクが当事者（source or target）である関連のみ解除できる
    if (!rel || (rel.sourceTaskId !== taskId && rel.targetTaskId !== taskId)) {
      throw new NotFoundException('関連が見つかりません');
    }
    await this.relations.remove(rel);
  }

  // ===== 内部 =====

  /** 入力の kind を保存形（source/target/type）へ正規化する。 */
  private normalize(
    taskId: string,
    otherId: string,
    kind: RelationKind,
  ): { sourceTaskId: string; targetTaskId: string; type: TaskRelationType } {
    switch (kind) {
      case 'related':
        return { sourceTaskId: taskId, targetTaskId: otherId, type: 'related' };
      case 'successor':
        return { sourceTaskId: taskId, targetTaskId: otherId, type: 'precedes' };
      case 'predecessor':
        return { sourceTaskId: otherId, targetTaskId: taskId, type: 'precedes' };
      case 'blocks':
        return { sourceTaskId: taskId, targetTaskId: otherId, type: 'blocks' };
      case 'blocked_by':
        return { sourceTaskId: otherId, targetTaskId: taskId, type: 'blocks' };
    }
  }

  /** 保存行を、起点タスクから見た kind と相手 id に変換する。 */
  private viewFor(taskId: string, r: TaskRelation): { kind: RelationKind; otherId: string } {
    const isSource = r.sourceTaskId === taskId;
    if (r.type === 'related') {
      return { kind: 'related', otherId: isSource ? r.targetTaskId : r.sourceTaskId };
    }
    if (r.type === 'precedes') {
      return isSource
        ? { kind: 'successor', otherId: r.targetTaskId }
        : { kind: 'predecessor', otherId: r.sourceTaskId };
    }
    return isSource
      ? { kind: 'blocks', otherId: r.targetTaskId }
      : { kind: 'blocked_by', otherId: r.sourceTaskId };
  }

  private async assertNotDuplicate(
    sourceTaskId: string,
    targetTaskId: string,
    type: TaskRelationType,
  ): Promise<void> {
    const where = [{ sourceTaskId, targetTaskId, type }];
    // related は対称なので逆向きも重複とみなす
    if (type === 'related') {
      where.push({ sourceTaskId: targetTaskId, targetTaskId: sourceTaskId, type });
    }
    const existing = await this.relations.findOne({ where });
    if (existing) throw new ConflictException('その関連は既に存在します');
  }

  private async buildViews(taskId: string, rows: TaskRelation[]): Promise<TaskRelationView[]> {
    const otherIds = [
      ...new Set(rows.map((r) => (r.sourceTaskId === taskId ? r.targetTaskId : r.sourceTaskId))),
    ];
    const others = await this.tasks.find({
      where: { id: In(otherIds) },
      select: { id: true, seq: true, content: true, statusCode: true },
    });
    const map = new Map(others.map((t) => [t.id, t]));
    return rows.map((r) => {
      const { kind, otherId } = this.viewFor(taskId, r);
      const other = map.get(otherId);
      return {
        id: r.id,
        kind,
        otherTaskId: otherId,
        otherSeq: other?.seq ?? 0,
        otherContent: other?.content ?? '',
        otherStatusCode: other?.statusCode ?? '',
      };
    });
  }

  private async assertTaskInProject(
    tenantId: string,
    projectId: string,
    taskId: string,
  ): Promise<void> {
    await this.projects.findByIdInTenant(tenantId, projectId);
    const task = await this.tasks.findOne({
      where: { projectId, id: taskId },
      select: { id: true },
    });
    if (!task) throw new NotFoundException('タスクが見つかりません');
  }
}
