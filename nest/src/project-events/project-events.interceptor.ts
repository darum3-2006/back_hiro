import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type Observable, tap } from 'rxjs';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { ProjectsService } from '../projects/projects.service';
import { ProjectEventsService, type ProjectEventType } from './project-events.service';

/**
 * パスからイベント種別を割り出す。
 * より具体的なリソース（comments 等）を先に判定する（/tasks/:id/comments は comments 扱い）。
 */
const classify = (path: string): ProjectEventType[] => {
  if (path.includes('/saved-views')) return ['views.changed'];
  if (path.includes('/comments')) return ['comments.changed'];
  if (path.includes('/members')) return ['members.changed'];
  // フラグ操作（一括付替え・全解除等）はタスク側の割当も変える
  if (path.includes('/flags')) return ['masters.changed', 'tasks.changed'];
  if (
    path.includes('/task-statuses') ||
    path.includes('/task-priorities') ||
    path.includes('/tags')
  ) {
    return ['masters.changed'];
  }
  if (path.includes('/tasks') || path.includes('/relations') || path.includes('/subtasks')) {
    return ['tasks.changed'];
  }
  return [];
};

/**
 * /projects/:projectId 配下の書き込み系リクエストが成功したら、パスから種別を割り出して
 * データ更新イベントを emit するグローバルフック。service 個別の発火実装を不要にする。
 * 公開 API v1（/v1/projects/:key/...）は :key からプロジェクトを解決して同様に emit する。
 */
@Injectable()
export class ProjectEventsInterceptor implements NestInterceptor {
  constructor(
    private readonly events: ProjectEventsService,
    private readonly projects: ProjectsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap(() => {
        const req = context.switchToHttp().getRequest<{
          method: string;
          path: string;
          params?: Record<string, string>;
          headers?: Record<string, string | string[] | undefined>;
          user?: AuthenticatedUser;
        }>();
        if (req.method === 'GET') return;
        const user = req.user;
        if (!user) return;
        const types = classify(req.path);
        if (types.length === 0) return;

        const rawClientId = req.headers?.['x-client-id'];
        const originClientId = Array.isArray(rawClientId) ? rawClientId[0] : rawClientId;
        const emitAll = (projectId: string, taskId: string | undefined) => {
          for (const type of types) {
            this.events.emit(projectId, {
              type,
              taskId: type === 'tasks.changed' || type === 'comments.changed' ? taskId : undefined,
              originUserId: user.userId,
              originClientId,
            });
          }
        };

        const projectId = req.params?.projectId;
        if (projectId) {
          // タスク配下のサブリソースは :taskId、タスク本体の更新/削除は :id が対象タスク
          emitAll(projectId, req.params?.taskId ?? req.params?.id);
          return;
        }

        // 公開 API v1: :key（プロジェクトキー）を解決してから emit する（ベストエフォート）。
        // タスクは :seq 指定で UUID が取れないため taskId は付けない
        const key = req.params?.key;
        if (!key || !req.path.includes('/v1/projects/')) return;
        void this.projects
          .findByKeyInTenant(user.tenantId, key)
          .then((project) => emitAll(project.id, undefined))
          .catch(() => undefined);
      }),
    );
  }
}
