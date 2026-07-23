import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ProjectEventsInterceptor } from './project-events.interceptor';
import { ProjectEventsService, type ProjectEvent } from './project-events.service';

describe('ProjectEventsService', () => {
  it('emit したイベントが購読側に届く（プロジェクト単位）', () => {
    const service = new ProjectEventsService();
    const received: ProjectEvent[] = [];
    service.stream('p1').subscribe((e) => received.push(e));

    service.emit('p1', { type: 'tasks.changed', originUserId: 'u1' });
    service.emit('p2', { type: 'tasks.changed', originUserId: 'u1' });

    expect(received).toEqual([{ type: 'tasks.changed', originUserId: 'u1' }]);
  });

  it('購読者がいないプロジェクトへの emit は無害', () => {
    const service = new ProjectEventsService();
    expect(() =>
      service.emit('nobody', { type: 'tasks.changed', originUserId: 'u1' }),
    ).not.toThrow();
  });
});

describe('ProjectEventsInterceptor', () => {
  let service: jest.Mocked<Pick<ProjectEventsService, 'emit'>>;
  let interceptor: ProjectEventsInterceptor;

  const user = { userId: 'user-1', tenantId: 'tenant-1', role: 'member' };

  const makeContext = (req: {
    method: string;
    path: string;
    params?: Record<string, string>;
    headers?: Record<string, string | string[]>;
    user?: unknown;
  }): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
    }) as unknown as ExecutionContext;

  const next: CallHandler = { handle: () => of('ok') };

  const run = async (req: Parameters<typeof makeContext>[0]) => {
    await firstValueFrom(interceptor.intercept(makeContext(req), next));
  };

  beforeEach(() => {
    service = { emit: jest.fn() };
    interceptor = new ProjectEventsInterceptor(service as unknown as ProjectEventsService);
  });

  it('タスク作成（POST /projects/:projectId/tasks）で tasks.changed を emit', async () => {
    await run({
      method: 'POST',
      path: '/api/projects/p1/tasks',
      params: { projectId: 'p1' },
      user,
    });

    expect(service.emit).toHaveBeenCalledWith('p1', {
      type: 'tasks.changed',
      taskId: undefined,
      originUserId: 'user-1',
    });
  });

  it('タスク更新（PATCH /tasks/:id）は taskId 付きで emit', async () => {
    await run({
      method: 'PATCH',
      path: '/api/projects/p1/tasks/t1',
      params: { projectId: 'p1', id: 't1' },
      user,
    });

    expect(service.emit).toHaveBeenCalledWith('p1', {
      type: 'tasks.changed',
      taskId: 't1',
      originUserId: 'user-1',
    });
  });

  it('X-Client-Id ヘッダがあれば originClientId として載せる', async () => {
    await run({
      method: 'PATCH',
      path: '/api/projects/p1/tasks/t1',
      params: { projectId: 'p1', id: 't1' },
      headers: { 'x-client-id': 'tab-abc' },
      user,
    });

    expect(service.emit).toHaveBeenCalledWith('p1', {
      type: 'tasks.changed',
      taskId: 't1',
      originUserId: 'user-1',
      originClientId: 'tab-abc',
    });
  });

  it('コメント作成は comments.changed（親タスク id 付き）', async () => {
    await run({
      method: 'POST',
      path: '/api/projects/p1/tasks/t1/comments',
      params: { projectId: 'p1', taskId: 't1' },
      user,
    });

    expect(service.emit).toHaveBeenCalledTimes(1);
    expect(service.emit).toHaveBeenCalledWith('p1', {
      type: 'comments.changed',
      taskId: 't1',
      originUserId: 'user-1',
    });
  });

  it('サブタスク・関連タスクは tasks.changed（親タスク id 付き）', async () => {
    await run({
      method: 'POST',
      path: '/api/projects/p1/tasks/t1/subtasks',
      params: { projectId: 'p1', taskId: 't1' },
      user,
    });
    await run({
      method: 'DELETE',
      path: '/api/projects/p1/tasks/t1/relations/r1',
      params: { projectId: 'p1', taskId: 't1', id: 'r1' },
      user,
    });

    expect(service.emit).toHaveBeenNthCalledWith(1, 'p1', {
      type: 'tasks.changed',
      taskId: 't1',
      originUserId: 'user-1',
    });
    expect(service.emit).toHaveBeenNthCalledWith(2, 'p1', {
      type: 'tasks.changed',
      taskId: 't1',
      originUserId: 'user-1',
    });
  });

  it('マスタ系（statuses / priorities / tags）は masters.changed のみ', async () => {
    await run({
      method: 'PATCH',
      path: '/api/projects/p1/task-statuses/s1',
      params: { projectId: 'p1', code: 's1' },
      user,
    });

    expect(service.emit).toHaveBeenCalledTimes(1);
    expect(service.emit).toHaveBeenCalledWith('p1', {
      type: 'masters.changed',
      taskId: undefined,
      originUserId: 'user-1',
    });
  });

  it('フラグ操作はタスク割当も変わるので masters.changed と tasks.changed の両方', async () => {
    await run({
      method: 'POST',
      path: '/api/projects/p1/flags/f1/move-to/f2',
      params: { projectId: 'p1', code: 'f1' },
      user,
    });

    expect(service.emit).toHaveBeenCalledTimes(2);
    expect(service.emit).toHaveBeenCalledWith('p1', {
      type: 'masters.changed',
      taskId: undefined,
      originUserId: 'user-1',
    });
    expect(service.emit).toHaveBeenCalledWith('p1', {
      type: 'tasks.changed',
      taskId: undefined,
      originUserId: 'user-1',
    });
  });

  it('保存ビューは views.changed（taskId なし）', async () => {
    await run({
      method: 'DELETE',
      path: '/api/projects/p1/saved-views/v1',
      params: { projectId: 'p1', id: 'v1' },
      user,
    });

    expect(service.emit).toHaveBeenCalledWith('p1', {
      type: 'views.changed',
      taskId: undefined,
      originUserId: 'user-1',
    });
  });

  it('GET リクエストでは emit しない', async () => {
    await run({
      method: 'GET',
      path: '/api/projects/p1/tasks',
      params: { projectId: 'p1' },
      user,
    });

    expect(service.emit).not.toHaveBeenCalled();
  });

  it('projectId パラメータのないルートでは emit しない', async () => {
    await run({ method: 'POST', path: '/api/departments', params: {}, user });

    expect(service.emit).not.toHaveBeenCalled();
  });

  it('未認証（user なし）では emit しない', async () => {
    await run({
      method: 'POST',
      path: '/api/projects/p1/tasks',
      params: { projectId: 'p1' },
    });

    expect(service.emit).not.toHaveBeenCalled();
  });
});
