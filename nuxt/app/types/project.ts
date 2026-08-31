import type { MasterColor } from '~/types/master';

export interface Project {
  id: string;
  key: string;
  name: string;
  description: string | null;
  /** テーマ色（ヘッダ等の背景に使う。null=未設定） */
  color: MasterColor | null;
  archivedAt: string | null;
  highlightOverdueDeadline: boolean;
  highlightOverduePlannedStart: boolean;
  highlightOverduePlannedCompletion: boolean;
  highlightOverduePlannedRelease: boolean;
  /** Slack Webhook が設定済みか（URL の生値は返さない） */
  slackWebhookConfigured: boolean;
  slackNotifyTaskCreated: boolean;
  slackNotifyStatusChanged: boolean;
  slackNotifyTaskCompleted: boolean;
}
