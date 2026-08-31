import type { MasterColor } from '~/types/master';
import type { Project } from '~/types/project';

export interface CreateProjectInput {
  key: string;
  name: string;
  description: string | null;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string | null;
  /** テーマ色。null で解除 */
  color?: MasterColor | null;
  /** true でアーカイブ、false で復元 */
  archived?: boolean;
  highlightOverdueDeadline?: boolean;
  highlightOverduePlannedStart?: boolean;
  highlightOverduePlannedCompletion?: boolean;
  highlightOverduePlannedRelease?: boolean;
  /** Slack Incoming Webhook URL。null / '' で解除 */
  slackWebhookUrl?: string | null;
  slackNotifyTaskCreated?: boolean;
  slackNotifyStatusChanged?: boolean;
  slackNotifyTaskCompleted?: boolean;
}

/** GET /api/projects */
export const apiListProjects = (api: typeof $fetch): Promise<Project[]> =>
  api<Project[]>('/projects');

/** POST /api/projects */
export const apiCreateProject = (api: typeof $fetch, input: CreateProjectInput): Promise<Project> =>
  api<Project>('/projects', { method: 'POST', body: input });

/** PATCH /api/projects/:id */
export const apiUpdateProject = (
  api: typeof $fetch,
  id: string,
  patch: UpdateProjectInput,
): Promise<Project> => api<Project>(`/projects/${id}`, { method: 'PATCH', body: patch });

/** POST /api/projects/:id/slack/test — 設定済み Webhook へテスト通知を送る */
export const apiTestSlack = (api: typeof $fetch, id: string): Promise<{ ok: true }> =>
  api<{ ok: true }>(`/projects/${id}/slack/test`, { method: 'POST' });
