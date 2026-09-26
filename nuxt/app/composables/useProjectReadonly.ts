import type { Project } from '~/types/project';

/**
 * 今開いているプロジェクトで「閲覧のみ」か（編集できないか）。
 *
 * 閲覧のみになるのは次の 2 通り（判定の正本はサーバの ProjectAccessGuard）。
 * - readonly ロールのユーザー（テナント単位）
 * - 閲覧権はあるが、このプロジェクトの ProjectMember でないユーザー
 *
 * 後者はプロジェクトごとに違うので、GET /projects が返す canEdit を見る。
 * プロジェクト一覧はレイアウトが読み込むので、ここでは取りに行かずキャッシュを読むだけにする。
 * 読み込み前やプロジェクトが見つからないときは、安全側（閲覧のみ）に倒す。
 */
export const useProjectReadonly = () => {
  const { isReadonly: tenantReadonly } = useAuth();
  const projectId = useCurrentProjectId();
  const { data: projects } = useNuxtData<Project[]>('projects');
  return computed(() => {
    if (tenantReadonly.value) return true;
    const project = projects.value?.find((p) => p.id === projectId.value);
    return !(project?.canEdit ?? false);
  });
};
