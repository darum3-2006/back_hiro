import dayjs from 'dayjs';
import type { Ref } from 'vue';
import type { Granularity } from '~/utils/gantt';

/** 粒度ごとの 1 日あたりピクセル幅 */
const PX_PER_DAY: Record<Granularity, number> = { day: 40, week: 16, month: 5 };

interface GanttScaleOptions {
  granularity: Ref<Granularity>;
  /** 表示期間の開始 / 終了（YYYY-MM-DD） */
  domainStart: Ref<string>;
  domainEnd: Ref<string>;
}

export interface GanttTick {
  x: number;
  label: string;
  major: boolean;
}

/**
 * ガントの時間軸演算。粒度に応じた px/日・総幅・目盛り・日付→X 変換・今日線位置を返す。
 * 粒度を増やすときは PX_PER_DAY と ticks の分岐に 1 ケース足すだけ。
 */
export const useGanttScale = (opts: GanttScaleOptions) => {
  const pxPerDay = computed(() => PX_PER_DAY[opts.granularity.value]);
  const start = computed(() => dayjs(opts.domainStart.value).startOf('day'));
  const end = computed(() => dayjs(opts.domainEnd.value).startOf('day'));
  const totalDays = computed(() => Math.max(1, end.value.diff(start.value, 'day') + 1));
  const totalWidth = computed(() => totalDays.value * pxPerDay.value);

  const xOf = (date: string | null): number | null => {
    if (!date) return null;
    return dayjs(date).startOf('day').diff(start.value, 'day') * pxPerDay.value;
  };

  /** 着手→完了の inclusive な幅（最低 1 日分） */
  const widthOf = (from: string | null, to: string | null): number => {
    if (!from || !to) return pxPerDay.value;
    const days = dayjs(to).startOf('day').diff(dayjs(from).startOf('day'), 'day') + 1;
    return Math.max(1, days) * pxPerDay.value;
  };

  const ticks = computed<GanttTick[]>(() => {
    const g = opts.granularity.value;
    const s = start.value;
    const e = end.value;
    const px = pxPerDay.value;
    const out: GanttTick[] = [];
    const inRange = (d: dayjs.Dayjs) => d.isBefore(e) || d.isSame(e, 'day');

    if (g === 'month') {
      let cur = s.startOf('month');
      while (inRange(cur)) {
        out.push({
          x: cur.diff(s, 'day') * px,
          label: cur.format('YYYY/M'),
          major: cur.month() === 0,
        });
        cur = cur.add(1, 'month');
      }
    } else if (g === 'week') {
      // 週頭（月曜）に合わせる
      let cur = s.startOf('week').add(1, 'day');
      if (cur.isAfter(s)) cur = cur.subtract(7, 'day');
      while (inRange(cur)) {
        out.push({ x: cur.diff(s, 'day') * px, label: cur.format('M/D'), major: cur.date() <= 7 });
        cur = cur.add(7, 'day');
      }
    } else {
      let cur = s;
      while (inRange(cur)) {
        out.push({ x: cur.diff(s, 'day') * px, label: cur.format('D'), major: cur.date() === 1 });
        cur = cur.add(1, 'day');
      }
    }
    return out;
  });

  const todayX = computed<number | null>(() => {
    const t = dayjs().startOf('day');
    if (t.isBefore(start.value) || t.isAfter(end.value)) return null;
    return t.diff(start.value, 'day') * pxPerDay.value;
  });

  return { pxPerDay, totalWidth, xOf, widthOf, ticks, todayX };
};

export type GanttScale = ReturnType<typeof useGanttScale>;
