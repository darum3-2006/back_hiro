import { buildTaskChanges, TaskChangeLabels, TaskFieldSnapshot } from './task-audit';

const emptyLabels = (): TaskChangeLabels => ({
  status: new Map(),
  priority: new Map(),
  member: new Map(),
  dept: new Map(),
  tag: new Map(),
});

const snapshot = (over: Partial<TaskFieldSnapshot> = {}): TaskFieldSnapshot => ({
  content: 'タイトル',
  description: '',
  statusCode: 'todo',
  priorityCode: null,
  assigneeMemberId: null,
  requesterMemberId: null,
  requestingDeptCode: null,
  deadline: null,
  plannedCompletionDate: null,
  plannedReleaseDate: null,
  links: [],
  tagCodes: [],
  ...over,
});

describe('buildTaskChanges', () => {
  it('変更がなければ空配列', () => {
    const s = snapshot();
    expect(buildTaskChanges(s, s, emptyLabels())).toEqual([]);
  });

  it('status 変更でラベルスナップショットが付く', () => {
    const labels = emptyLabels();
    labels.status.set('todo', '未対応').set('doing', '対応中');
    const changes = buildTaskChanges(
      snapshot({ statusCode: 'todo' }),
      snapshot({ statusCode: 'doing' }),
      labels,
    );
    expect(changes).toEqual([
      { field: 'status', old: 'todo', new: 'doing', oldLabel: '未対応', newLabel: '対応中' },
    ]);
  });

  it('ラベル未解決のコードはコードがそのままラベルになる', () => {
    const changes = buildTaskChanges(
      snapshot({ statusCode: 'todo' }),
      snapshot({ statusCode: 'doing' }),
      emptyLabels(),
    );
    expect(changes[0]).toMatchObject({ oldLabel: 'todo', newLabel: 'doing' });
  });

  it('assignee の null(未割当) → メンバー も記録', () => {
    const labels = emptyLabels();
    labels.member.set('m1', '山田');
    const changes = buildTaskChanges(
      snapshot({ assigneeMemberId: null }),
      snapshot({ assigneeMemberId: 'm1' }),
      labels,
    );
    expect(changes).toEqual([
      { field: 'assignee', old: null, new: 'm1', oldLabel: null, newLabel: '山田' },
    ]);
  });

  it('deadline 変更は値のみ（ラベルなし）', () => {
    const changes = buildTaskChanges(
      snapshot({ deadline: null }),
      snapshot({ deadline: '2026-06-30' }),
      emptyLabels(),
    );
    expect(changes).toEqual([{ field: 'deadline', old: null, new: '2026-06-30' }]);
  });

  it('description はフラグのみ（old/new は null）', () => {
    const changes = buildTaskChanges(
      snapshot({ description: 'a' }),
      snapshot({ description: 'b' }),
      emptyLabels(),
    );
    expect(changes).toEqual([{ field: 'description', old: null, new: null }]);
  });

  it('links は内容変化でフラグのみ', () => {
    const changes = buildTaskChanges(
      snapshot({ links: [] }),
      snapshot({ links: [{ label: 'PR', url: 'https://example.com' }] }),
      emptyLabels(),
    );
    expect(changes).toEqual([{ field: 'links', old: null, new: null }]);
  });

  it('tags は順序非依存で比較し、変化時に code/label を連結', () => {
    const labels = emptyLabels();
    labels.tag.set('bug', 'バグ').set('feat', '機能');
    // 同じ集合（順序違い）は変更なし
    expect(
      buildTaskChanges(
        snapshot({ tagCodes: ['bug', 'feat'] }),
        snapshot({ tagCodes: ['feat', 'bug'] }),
        labels,
      ),
    ).toEqual([]);
    // 追加で変更検知
    const changes = buildTaskChanges(
      snapshot({ tagCodes: ['bug'] }),
      snapshot({ tagCodes: ['bug', 'feat'] }),
      labels,
    );
    expect(changes).toEqual([
      { field: 'tags', old: 'bug', new: 'bug,feat', oldLabel: 'バグ', newLabel: 'バグ, 機能' },
    ]);
  });

  it('複数フィールド同時変更を全て返す', () => {
    const changes = buildTaskChanges(
      snapshot({ statusCode: 'todo', content: 'a' }),
      snapshot({ statusCode: 'doing', content: 'b' }),
      emptyLabels(),
    );
    expect(changes.map((c) => c.field).sort()).toEqual(['content', 'status']);
  });
});
