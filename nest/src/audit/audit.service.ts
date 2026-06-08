import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { AuditAction, AuditChange, AuditEntityType, AuditLog } from './audit-log.entity';

/** 監査ログ 1 件の記録に必要な入力。 */
export interface RecordAuditInput {
  tenantId: string;
  entityType: AuditEntityType;
  entityId: string;
  projectId: string | null;
  action: AuditAction;
  /** update のとき必須。create / delete は省略可。 */
  changes?: AuditChange[] | null;
  /** 操作した User。システム操作なら null。 */
  actorUserId: string | null;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly logs: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  /**
   * 監査ログを 1 件記録する。
   * 操作者の表示名は記録時点でスナップショットする（後で改名・退会しても履歴は残る）。
   * トランザクション内から呼ぶ場合は manager を渡すと同一トランザクションで書き込む。
   */
  async record(input: RecordAuditInput, manager?: EntityManager): Promise<void> {
    const logRepo = manager ? manager.getRepository(AuditLog) : this.logs;
    const userRepo = manager ? manager.getRepository(User) : this.users;

    const actorUserName = input.actorUserId
      ? ((await userRepo.findOne({ where: { id: input.actorUserId }, select: { name: true } }))
          ?.name ?? null)
      : null;

    const log = logRepo.create({
      tenantId: input.tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      projectId: input.projectId,
      action: input.action,
      changes: input.changes ?? null,
      actorUserId: input.actorUserId,
      actorUserName,
    });
    await logRepo.save(log);
  }

  /** あるエンティティの監査ログを時系列（昇順）で返す。 */
  listForEntity(
    tenantId: string,
    entityType: AuditEntityType,
    entityId: string,
  ): Promise<AuditLog[]> {
    return this.logs.find({
      where: { tenantId, entityType, entityId },
      order: { createdAt: 'ASC' },
    });
  }
}
