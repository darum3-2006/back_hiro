/** アプリ内通知（受信者視点の 1 件）。DOM の Notification と衝突しないよう App 接頭辞。 */
export interface AppNotification {
  id: string;
  type: string;
  projectId: string | null;
  taskId: string | null;
  taskSeq: number | null;
  actorUserId: string | null;
  message: string;
  readAt: string | null;
  createdAt: string;
}

/** 通知タイプの ON/OFF 設定（マイページ通知タブ） */
export interface NotificationPreference {
  type: string;
  label: string;
  enabled: boolean;
}
