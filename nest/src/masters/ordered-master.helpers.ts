import { Repository } from 'typeorm';

/**
 * (project_id, code) で一意・display_order を持つマスタの共通処理。
 * TypeORM のジェネリック where 型が厳しいので、Repository<any> として扱う。
 */
export interface OrderedMasterEntity {
  id: string;
  projectId: string;
  code: string;
  order: number;
}

type OrderedRepo = Repository<OrderedMasterEntity>;

export const generateMasterCode = (prefix: string): string =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

export const nextOrder = async (repo: OrderedRepo, projectId: string): Promise<number> => {
  // 既存の最大 display_order + 1。MySQL は order が予約語なので alias 経由で取得。
  const row = await repo
    .createQueryBuilder('m')
    .select('MAX(m.order)', 'maxOrder')
    .where('m.project_id = :projectId', { projectId })
    .getRawOne<{ maxOrder: number | null }>();
  return (row?.maxOrder ?? 0) + 1;
};

/**
 * 隣接行とスワップ。同一トランザクション内で 2 行 update。
 */
export const swapWithNeighbour = async (
  repo: OrderedRepo,
  projectId: string,
  code: string,
  direction: 'up' | 'down',
): Promise<void> => {
  await repo.manager.transaction(async (em) => {
    const tx = em.getRepository<OrderedMasterEntity>(repo.target);
    const list = await tx.find({ where: { projectId }, order: { order: 'ASC' } });
    const idx = list.findIndex((m) => m.code === code);
    if (idx < 0) return;
    const partnerIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (partnerIdx < 0 || partnerIdx >= list.length) return;
    const a = list[idx];
    const b = list[partnerIdx];
    [a.order, b.order] = [b.order, a.order];
    await tx.save([a, b]);
  });
};

/**
 * orderedCodes に従って display_order を 1, 2, 3, ... で振り直す。
 * 含まれていない既存項目は末尾へ。
 */
export const reorderByCodes = async (
  repo: OrderedRepo,
  projectId: string,
  orderedCodes: string[],
): Promise<void> => {
  await repo.manager.transaction(async (em) => {
    const tx = em.getRepository<OrderedMasterEntity>(repo.target);
    const list = await tx.find({ where: { projectId } });
    let order = 1;
    for (const code of orderedCodes) {
      const item = list.find((m) => m.code === code);
      if (item) {
        item.order = order++;
      }
    }
    const remaining = list.filter((m) => !orderedCodes.includes(m.code));
    for (const item of remaining) {
      item.order = order++;
    }
    await tx.save(list);
  });
};
