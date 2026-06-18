import type { Department, MasterColor, Tag, TaskPriority, TaskStatus } from '~/types/master';
import type { Member } from '~/types/member';
import type { Task } from '~/types/task';

export type Granularity = 'day' | 'week' | 'month';
export type GroupByKey = 'none' | 'assignee' | 'status' | 'priority' | 'dept' | 'tag';
export type RowSortKey = 'plannedStart' | 'deadline' | 'seq';

/** 1 グループ（フラット時は単一・ヘッダ非表示） */
export interface GanttGroup {
  key: string;
  label: string;
  color?: MasterColor;
  tasks: Task[];
}

/** グループ化に必要なマスタ（順序つき） */
export interface GanttGroupContext {
  members: Member[];
  statuses: TaskStatus[];
  priorities: TaskPriority[];
  departments: Department[];
  tags: Tag[];
}

interface GanttGroupDef {
  label: string;
  build: (tasks: Task[], ctx: GanttGroupContext) => GanttGroup[];
}

const UNSET_LABEL = '（未設定）';

/** code/id → tasks の Map を、空でないものだけ defs 順に並べて返す補助 */
const groupBy = <T>(
  tasks: Task[],
  keyOf: (t: Task) => string | null,
  ordered: T[],
  idOf: (o: T) => string,
  labelOf: (o: T) => string,
  colorOf?: (o: T) => MasterColor,
): GanttGroup[] => {
  const byKey = new Map<string, Task[]>();
  for (const t of tasks) {
    const k = keyOf(t) ?? '__unset__';
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(t);
  }
  const groups: GanttGroup[] = [];
  for (const o of ordered) {
    const id = idOf(o);
    const ts = byKey.get(id);
    if (ts && ts.length > 0) {
      groups.push({ key: id, label: labelOf(o), color: colorOf?.(o), tasks: ts });
    }
  }
  const unset = byKey.get('__unset__');
  if (unset && unset.length > 0) {
    groups.push({ key: '__unset__', label: UNSET_LABEL, tasks: unset });
  }
  return groups;
};

/**
 * グルーピング軸の登録表。**軸を増やすときはここに 1 エントリ足すだけ**。
 * 各 build はマスタ順に並んだ「空でないグループ」を返す。
 */
export const GANTT_GROUP_DEFS: Record<GroupByKey, GanttGroupDef> = {
  none: {
    label: 'なし',
    build: (tasks) => [{ key: 'all', label: '', tasks }],
  },
  assignee: {
    label: '担当者',
    build: (tasks, ctx) =>
      groupBy(
        tasks,
        (t) => t.assigneeMemberId,
        ctx.members,
        (m) => m.id,
        (m) => m.displayName,
      ),
  },
  status: {
    label: 'ステータス',
    build: (tasks, ctx) =>
      groupBy(
        tasks,
        (t) => t.statusCode,
        ctx.statuses,
        (s) => s.code,
        (s) => s.label,
        (s) => s.color,
      ),
  },
  priority: {
    label: '優先度',
    build: (tasks, ctx) =>
      groupBy(
        tasks,
        (t) => t.priorityCode,
        ctx.priorities,
        (p) => p.code,
        (p) => p.label,
        (p) => p.color,
      ),
  },
  dept: {
    label: '依頼部署',
    build: (tasks, ctx) =>
      groupBy(
        tasks,
        (t) => t.requestingDeptCode,
        ctx.departments,
        (d) => d.code,
        (d) => d.name,
      ),
  },
  tag: {
    label: 'タグ',
    // タグは複数持ちうるため、タスクは付いている各タグに重複して現れる。
    build: (tasks, ctx) => {
      const groups: GanttGroup[] = [];
      for (const tag of ctx.tags) {
        const ts = tasks.filter((t) => t.tagCodes.includes(tag.code));
        if (ts.length > 0) {
          groups.push({ key: tag.code, label: tag.name, color: tag.color, tasks: ts });
        }
      }
      const untagged = tasks.filter((t) => t.tagCodes.length === 0);
      if (untagged.length > 0) {
        groups.push({ key: '__unset__', label: UNSET_LABEL, tasks: untagged });
      }
      return groups;
    },
  },
};

/** nullable な日付文字列の昇順比較（null は末尾）。同値は seq で安定化 */
const byNullableDate =
  (dateOf: (t: Task) => string | null) =>
  (a: Task, b: Task): number => {
    const da = dateOf(a);
    const db = dateOf(b);
    if (da !== db) {
      if (!da) return 1;
      if (!db) return -1;
      return da < db ? -1 : 1;
    }
    return a.seq - b.seq;
  };

/** 行ソートの登録表。**並べ方を増やすときはここに 1 エントリ**。 */
export const GANTT_ROW_SORTS: Record<
  RowSortKey,
  { label: string; compare: (a: Task, b: Task) => number }
> = {
  plannedStart: { label: '着手予定日', compare: byNullableDate((t) => t.plannedStartDate) },
  deadline: { label: '期限', compare: byNullableDate((t) => t.deadline) },
  seq: { label: 'No', compare: (a, b) => a.seq - b.seq },
};

/**
 * バー背景色クラス（MasterColor → 固定 Tailwind クラス）。
 * 動的クラス生成は purge されるため、リテラルで列挙する。
 */
export const ganttBarColorClass = (color: MasterColor | undefined): string => {
  const map: Record<MasterColor, string> = {
    neutral: 'bg-neutral-400',
    primary: 'bg-primary',
    secondary: 'bg-secondary',
    info: 'bg-info',
    success: 'bg-success',
    warning: 'bg-warning',
    error: 'bg-error',
    rose: 'bg-rose-500',
    sky: 'bg-sky-500',
    amber: 'bg-amber-500',
    fuchsia: 'bg-fuchsia-500',
    emerald: 'bg-emerald-500',
    violet: 'bg-violet-500',
  };
  return color ? map[color] : 'bg-primary';
};

/** ガントに描画できる（着手予定日・完了予定日が両方ある）か */
export const isScheduled = (t: Task): boolean =>
  Boolean(t.plannedStartDate && t.plannedCompletionDate);
