/** サーバの ProjectEventType と対応（nest/src/project-events/project-events.service.ts） */
export type ProjectEventType =
  | 'tasks.changed'
  | 'comments.changed'
  | 'masters.changed'
  | 'members.changed'
  | 'views.changed';

export interface ProjectEvent {
  type: ProjectEventType;
  taskId?: string;
  originUserId: string;
  /** 変更を行ったタブの ID（X-Client-Id ヘッダ由来）。自タブ発イベントの無視に使う */
  originClientId?: string;
}

type Handler = (e: ProjectEvent) => void;

const EVENT_TYPES: ProjectEventType[] = [
  'tasks.changed',
  'comments.changed',
  'masters.changed',
  'members.changed',
  'views.changed',
];

interface Connection {
  es: EventSource;
  handlers: Set<Handler>;
}

// SSE 接続はプロジェクトごとに 1 本をモジュールスコープで共有し、
// 同一プロジェクトの複数購読者（一覧ページ + 詳細スライドオーバー等）で使い回す。
const connections = new Map<string, Connection>();

const subscribe = (projectId: string, token: string, handler: Handler): (() => void) => {
  let conn = connections.get(projectId);
  if (!conn) {
    const es = new EventSource(
      `/api/projects/${projectId}/events?token=${encodeURIComponent(token)}`,
    );
    const created: Connection = { es, handlers: new Set() };
    for (const type of EVENT_TYPES) {
      es.addEventListener(type, (ev) => {
        try {
          const event = JSON.parse((ev as MessageEvent).data) as ProjectEvent;
          created.handlers.forEach((h) => h(event));
        } catch {
          // 不正なペイロードは無視
        }
      });
    }
    // onerror 時は EventSource が自動再接続するため何もしない
    connections.set(projectId, created);
    conn = created;
  }
  conn.handlers.add(handler);
  return () => {
    conn.handlers.delete(handler);
    if (conn.handlers.size === 0) {
      conn.es.close();
      connections.delete(projectId);
    }
  };
};

/**
 * プロジェクトのデータ更新イベント（SSE）を購読し、種別ごとのハンドラを呼ぶ。
 * - 自タブの操作に由来するイベントは無視する（画面には反映済み。別タブには反映する）
 * - 短時間に連続するイベントは種別ごとにまとめ、最後の 1 回だけ通知する（一括編集対策）
 * - クライアント専用。unmount / projectId 変更時に自動で購読解除する
 */
export const useProjectEvents = (
  projectId: MaybeRefOrGetter<string | null | undefined>,
  handlers: Partial<Record<ProjectEventType, Handler>>,
) => {
  const token = useAuthToken();

  let unsubscribe: (() => void) | null = null;
  const timers = new Map<ProjectEventType, ReturnType<typeof setTimeout>>();

  const handle = (e: ProjectEvent) => {
    if (e.originClientId && e.originClientId === CLIENT_ID) return;
    const handler = handlers[e.type];
    if (!handler) return;
    clearTimeout(timers.get(e.type));
    timers.set(
      e.type,
      setTimeout(() => handler(e), 300),
    );
  };

  const start = () => {
    if (!import.meta.client) return;
    unsubscribe?.();
    unsubscribe = null;
    const pid = toValue(projectId);
    if (!pid || !token.value) return;
    unsubscribe = subscribe(pid, token.value, handle);
  };

  onMounted(start);
  watch(() => toValue(projectId), start);
  onUnmounted(() => {
    timers.forEach((t) => clearTimeout(t));
    unsubscribe?.();
    unsubscribe = null;
  });
};
