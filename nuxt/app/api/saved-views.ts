import type { CreateSavedViewInput, SavedView, UpdateSavedViewInput } from '~/types/saved-view';

/** GET /api/projects/:projectId/saved-views — 自分の private ＋ プロジェクトの shared */
export const apiListSavedViews = (api: typeof $fetch, projectId: string): Promise<SavedView[]> =>
  api<SavedView[]>(`/projects/${projectId}/saved-views`);

/** GET /api/saved-views/by-code/:code — 共有リンクの短縮コードからビューを解決する */
export const apiResolveSavedViewByCode = (
  api: typeof $fetch,
  code: string,
): Promise<{ projectId: string; viewId: string }> =>
  api<{ projectId: string; viewId: string }>(`/saved-views/by-code/${code}`);

/** POST /api/projects/:projectId/saved-views */
export const apiCreateSavedView = (
  api: typeof $fetch,
  projectId: string,
  input: CreateSavedViewInput,
): Promise<SavedView> =>
  api<SavedView>(`/projects/${projectId}/saved-views`, { method: 'POST', body: input });

/** PATCH /api/projects/:projectId/saved-views/:id */
export const apiUpdateSavedView = (
  api: typeof $fetch,
  projectId: string,
  id: string,
  patch: UpdateSavedViewInput,
): Promise<SavedView> =>
  api<SavedView>(`/projects/${projectId}/saved-views/${id}`, { method: 'PATCH', body: patch });

/** POST /api/projects/:projectId/saved-views/:id/duplicate — 共有ビューを自分の private として複製 */
export const apiDuplicateSavedView = (
  api: typeof $fetch,
  projectId: string,
  id: string,
): Promise<SavedView> =>
  api<SavedView>(`/projects/${projectId}/saved-views/${id}/duplicate`, { method: 'POST' });

/** DELETE /api/projects/:projectId/saved-views/:id */
export const apiDeleteSavedView = async (
  api: typeof $fetch,
  projectId: string,
  id: string,
): Promise<void> => {
  await api(`/projects/${projectId}/saved-views/${id}`, { method: 'DELETE' });
};
