import {
  buildLinkChanges,
  buildTaskChanges,
  TaskChangeLabels,
  TaskFieldSnapshot,
} from './task-audit';

const emptyLabels = (): TaskChangeLabels => ({
  status: new Map(),
  priority: new Map(),
  member: new Map(),
  dept: new Map(),
  tag: new Map(),
  flag: new Map(),
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
  plannedStartDate: null,
  plannedCompletionDate: null,
  plannedReleaseDate: null,
  links: [],
  tagCodes: [],
  flagCodes: [],
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

  it('links は 1 リンク 1 件の変更として記録する', () => {
    const changes = buildTaskChanges(
      snapshot({ links: [] }),
      snapshot({ links: [{ label: 'PR', url: 'https://example.com' }] }),
      emptyLabels(),
    );
    expect(changes).toEqual([
      { field: 'link_added', old: null, new: 'https://example.com', newLabel: 'PR' },
    ]);
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

  it('flags も順序非依存で比較し、変化時に code/label を連結', () => {
    const labels = emptyLabels();
    labels.flag.set('sprint', '今スプリント').set('check', '要確認');
    expect(
      buildTaskChanges(
        snapshot({ flagCodes: ['sprint', 'check'] }),
        snapshot({ flagCodes: ['check', 'sprint'] }),
        labels,
      ),
    ).toEqual([]);
    const changes = buildTaskChanges(
      snapshot({ flagCodes: ['sprint'] }),
      snapshot({ flagCodes: ['sprint', 'check'] }),
      labels,
    );
    expect(changes).toEqual([
      {
        field: 'flags',
        old: 'sprint',
        new: 'sprint,check',
        oldLabel: '今スプリント',
        newLabel: '今スプリント, 要確認',
      },
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

describe('buildLinkChanges', () => {
  const a = { label: 'A', url: 'https://a.example.com' };
  const b = { label: 'B', url: 'https://b.example.com' };
  const c = { label: 'C', url: 'https://c.example.com' };

  it('変化がなければ空', () => {
    expect(buildLinkChanges([a, b], [a, b])).toEqual([]);
  });

  it('追加', () => {
    expect(buildLinkChanges([a], [a, b])).toEqual([
      { field: 'link_added', old: null, new: b.url, newLabel: 'B' },
    ]);
  });

  it('途中のリンクを削除しても、後ろのリンクを書き換えと誤判定しない', () => {
    expect(buildLinkChanges([a, b, c], [a, c])).toEqual([
      { field: 'link_removed', old: b.url, new: null, oldLabel: 'B' },
    ]);
  });

  it('同じ位置で URL を変えたら書き換え（link_updated）', () => {
    const b2 = { label: 'B', url: 'https://b2.example.com' };
    expect(buildLinkChanges([a, b, c], [a, b2, c])).toEqual([
      { field: 'link_updated', old: b.url, new: b2.url, oldLabel: 'B', newLabel: 'B' },
    ]);
  });

  it('URL が同じで表示名だけ変えたら link_updated（old と new の URL が同じ）', () => {
    expect(buildLinkChanges([a], [{ ...a, label: 'A2' }])).toEqual([
      { field: 'link_updated', old: a.url, new: a.url, oldLabel: 'A', newLabel: 'A2' },
    ]);
  });

  it('並びだけ変わったら link_reordered', () => {
    expect(buildLinkChanges([a, b], [b, a])).toEqual([
      { field: 'link_reordered', old: null, new: null },
    ]);
  });

  it('全部消したら 1 件ずつ削除', () => {
    expect(buildLinkChanges([a, b], [])).toEqual([
      { field: 'link_removed', old: a.url, new: null, oldLabel: 'A' },
      { field: 'link_removed', old: b.url, new: null, oldLabel: 'B' },
    ]);
  });
});
