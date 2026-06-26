export interface Project {
  id: string;
  key: string;
  name: string;
  description: string | null;
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
