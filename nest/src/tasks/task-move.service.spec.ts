import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { EntityManager, Repository } from 'typeorm';
import type { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { Comment } from '../comments/comment.entity';
import { Flag } from '../masters/flag.entity';
import { Tag } from '../masters/tag.entity';
import { TaskPriority } from '../masters/task-priority.entity';
import { TaskStatus } from '../masters/task-status.entity';
import { ProjectMember } from '../members/member.entity';
import { Notification } from '../notifications/notification.entity';
import type { ProjectAccessService } from '../projects/project-access.service';
import { Project } from '../projects/project.entity';
import { SubtaskFlag } from '../subtasks/subtask-flag.entity';
import { Subtask } from '../subtasks/subtask.entity';
import { TaskRelation } from '../task-relations/task-relation.entity';
import { TaskFlag } from './task-flag.entity';
import { TaskMoveService } from './task-move.service';
import { TaskTag } from './task-tag.entity';
import { Task } from './task.entity';

type Row = Record<string, unknown>;

/**
 * where の条件（等値 / In / 配列=OR）で行を絞るだけの素朴な偽 EntityManager。
 * 付け替えの規則を検証するのが目的なので、クエリの細部は再現しない。
 */
type InCondition = { _type: 'in'; _value: unknown[] };
const isIn = (v: unknown): v is InCondition =>
  !!v && typeof v === 'object' && (v as { _type?: string })._type === 'in';

const matches = (row: Row, where: Row): boolean =>
  Object.entries(where).every(([k, v]) => (isIn(v) ? v._value.includes(row[k]) : row[k] === v));

const fakeManager = (tables: Map<unknown, Row[]>) => {
  const writes: { entity: unknown; op: string; args: unknown[] }[] = [];
  const repo = (entity: unknown) => {
    const rows = () => tables.get(entity) ?? [];
    const filter = (where?: Row | Row[]) =>
      !where
        ? rows()
        : rows().filter((r) => (Array.isArray(where) ? where : [where]).some((w) => matches(r, w)));
    const record =
      (op: string) =>
      (...args: unknown[]) => {
        writes.push({ entity, op, args });
        return Promise.resolve();
      };
    return {
      find: jest.fn((o?: { where?: Row | Row[] }) => Promise.resolve(filter(o?.where))),
      findOne: jest.fn((o?: { where?: Row | Row[] }) =>
        Promise.resolve(filter(o?.where)[0] ?? null),
      ),
      count: jest.fn((o?: { where?: Row | Row[] }) => Promise.resolve(filter(o?.where).length)),
      save: jest.fn((e: unknown) => {
        writes.push({ entity, op: 'save', args: [e] });
        return Promise.resolve(e);
      }),
      update: jest.fn(record('update')),
      delete: jest.fn(record('delete')),
      insert: jest.fn(record('insert')),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(() => Promise.resolve({ maxSeq: 57 })),
      })),
    };
  };
  const em = {
    getRepository: jest.fn((e: unknown) => repo(e)),
    transaction: jest.fn((fn: (m: unknown) => unknown) => Promise.resolve(fn(em))),
  } as unknown as EntityManager;
  return { em, writes };
};

describe('TaskMoveService', () => {
  const tenantId = 't1';
  const user: AuthenticatedUser = { userId: 'u1', tenantId, role: 'member' };
  const SRC = 'p-src';
  const DST = 'p-dst';

  let tables: Map<unknown, Row[]>;
  let access: jest.Mocked<Pick<ProjectAccessService, 'assertAccess' | 'assertEditor'>>;
  let audit: jest.Mocked<Pick<AuditService, 'record'>>;
  let writes: { entity: unknown; op: string; args: unknown[] }[];
  let service: TaskMoveService;

  const member = (
    id: string,
    projectId: string,
    userId: string | null,
    name: string,
    role = 'member',
  ) => ({
    id,
    projectId,
    userId,
    displayName: name,
    user: userId ? { role } : null,
  });

  beforeEach(() => {
    tables = new Map<unknown, Row[]>([
      [
        Project,
        [
          { id: SRC, tenantId, name: '移動元', archivedAt: null },
          { id: DST, tenantId, name: '移動先', archivedAt: null },
        ],
      ],
      [
        Task,
        [
          {
            id: 'task1',
            projectId: SRC,
            seq: 123,
            shortCode: 'abcdefghij',
            content: '修正',
            statusCode: 's-doing',
            priorityCode: 'pr-high',
            assigneeMemberId: 'm-src-me',
            requesterMemberId: 'm-src-cs',
            completedAt: null,
          },
        ],
      ],
      [
        TaskStatus,
        [
          {
            projectId: SRC,
            code: 's-doing',
            label: '対応中',
            isInitial: false,
            isTerminal: false,
            order: 2,
          },
          {
            projectId: DST,
            code: 's-new',
            label: '新規',
            isInitial: true,
            isTerminal: false,
            order: 1,
          },
          {
            projectId: DST,
            code: 's-doing2',
            label: ' 対応中 ',
            isInitial: false,
            isTerminal: false,
            order: 2,
          },
          {
            projectId: DST,
            code: 's-done',
            label: '完了',
            isInitial: false,
            isTerminal: true,
            order: 3,
          },
        ],
      ],
      [
        TaskPriority,
        [
          { projectId: SRC, code: 'pr-high', label: '高', order: 1 },
          { projectId: DST, code: 'pr-low', label: '低', order: 1 },
        ],
      ],
      [
        ProjectMember,
        [
          member('m-src-me', SRC, 'u1', '自分'),
          member('m-src-cs', SRC, null, 'CS（起票）'),
          member('m-src-sato', SRC, 'u-sato', '佐藤'),
          member('m-src-ro', SRC, 'u-ro', '閲覧', 'readonly'),
          member('m-dst-me', DST, 'u1', '自分（移動先）'),
          member('m-dst-cs', DST, null, 'CS（起票）'),
          member('m-dst-ro', DST, 'u-ro', '閲覧', 'readonly'),
        ],
      ],
      [
        Tag,
        [
          { id: 'tag-src-bug', projectId: SRC, name: 'バグ' },
          { id: 'tag-src-urgent', projectId: SRC, name: '至急' },
          { id: 'tag-dst-bug', projectId: DST, name: 'バグ' },
        ],
      ],
      [Flag, [{ id: 'flag-src', projectId: SRC, name: '今週' }]],
      [
        TaskTag,
        [
          { taskId: 'task1', tagId: 'tag-src-bug' },
          { taskId: 'task1', tagId: 'tag-src-urgent' },
        ],
      ],
      [TaskFlag, [{ taskId: 'task1', flagId: 'flag-src' }]],
      [Subtask, [{ id: 'sub1', taskId: 'task1', projectId: SRC, assigneeMemberId: 'm-src-ro' }]],
      [SubtaskFlag, []],
      [
        Comment,
        [
          { id: 'c1', taskId: 'task1', projectId: SRC, authorMemberId: 'm-src-me' },
          { id: 'c2', taskId: 'task1', projectId: SRC, authorMemberId: 'm-src-sato' },
          { id: 'c3', taskId: 'task1', projectId: SRC, authorMemberId: 'm-src-sato' },
        ],
      ],
      [TaskRelation, [{ sourceTaskId: 'task1', targetTaskId: 'task9' }]],
      [Notification, []],
    ]);
    const fake = fakeManager(tables);
    writes = fake.writes;
    access = {
      assertAccess: jest.fn().mockResolvedValue(undefined),
      assertEditor: jest.fn().mockResolvedValue(undefined),
    };
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    const tasksRepo = { manager: fake.em } as unknown as Repository<Task>;
    service = new TaskMoveService(
      tasksRepo,
      access as unknown as ProjectAccessService,
      audit as unknown as AuditService,
    );
  });

  describe('移動を止める条件', () => {
    it('同じプロジェクトへは移せない', async () => {
      await expect(service.preview(user, SRC, 'task1', SRC)).rejects.toThrow(BadRequestException);
    });

    it('移動先が見つからなければ 404（存在を伏せる）', async () => {
      await expect(service.preview(user, SRC, 'task1', 'p-none')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('移動元・移動先の両方で編集できるかを確かめる', async () => {
      await service.preview(user, SRC, 'task1', DST);

      expect(access.assertEditor).toHaveBeenCalledWith(user, SRC);
      expect(access.assertAccess).toHaveBeenCalledWith(user, DST);
      expect(access.assertEditor).toHaveBeenCalledWith(user, DST);
    });

    it('アーカイブされたプロジェクトへは移せない', async () => {
      (tables.get(Project) as Row[])[1].archivedAt = new Date();

      await expect(service.preview(user, SRC, 'task1', DST)).rejects.toThrow(BadRequestException);
    });

    it('移動先に無いステータスを指定したら移さない', async () => {
      await expect(
        service.move(user, SRC, 'task1', { targetProjectId: DST, statusCode: 's-doing' }),
      ).rejects.toThrow(BadRequestException);
      expect(writes).toHaveLength(0);
    });

    it('readonly ユーザーのメンバーは担当者にできない', async () => {
      await expect(
        service.move(user, SRC, 'task1', {
          targetProjectId: DST,
          statusCode: 's-new',
          assigneeMemberId: 'm-dst-ro',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('付け替えの規則（事前確認）', () => {
    it('ステータスは同じ名前（前後の空白は無視）、優先度は同じ名前が無ければなし', async () => {
      const pv = await service.preview(user, SRC, 'task1', DST);

      expect(pv.defaults.statusCode).toBe('s-doing2');
      expect(pv.defaults.priorityCode).toBeNull();
    });

    it('同じ名前のステータスが無ければ、移動先の初期ステータス', async () => {
      (tables.get(TaskStatus) as Row[])[2].label = '作業中';

      const pv = await service.preview(user, SRC, 'task1', DST);

      expect(pv.defaults.statusCode).toBe('s-new');
    });

    it('担当者は同じユーザー、ユーザーの無い擬人化メンバーは同じ表示名で突き合わせる', async () => {
      const pv = await service.preview(user, SRC, 'task1', DST);

      expect(pv.defaults.assigneeMemberId).toBe('m-dst-me');
      expect(pv.defaults.requesterMemberId).toBe('m-dst-cs');
    });

    it('タグは同じ名前だけ残り、無いものは外れる', async () => {
      const pv = await service.preview(user, SRC, 'task1', DST);

      expect(pv.tags).toEqual({ kept: ['バグ'], dropped: ['至急'] });
      expect(pv.flags).toEqual({ kept: [], dropped: ['今週'] });
    });

    it('移動先にいない投稿者のコメントを数え、サブタスクの担当で外れる人を出す', async () => {
      const pv = await service.preview(user, SRC, 'task1', DST);

      expect(pv.comments.unknownAuthors).toEqual([{ name: '佐藤', count: 2 }]);
      // 移動先の同じユーザーは readonly なので、サブタスクの担当としては外れる
      expect(pv.subtasks.droppedAssignees).toEqual(['閲覧']);
      expect(pv.relations.count).toBe(1);
    });
  });

  describe('移動', () => {
    const run = () =>
      service.move(user, SRC, 'task1', {
        targetProjectId: DST,
        statusCode: 's-done',
        assigneeMemberId: 'm-dst-me',
      });

    it('番号を振り直し、短縮コードは変えない', async () => {
      const res = await run();

      expect(res).toEqual({ projectId: DST, id: 'task1', seq: 58, shortCode: 'abcdefghij' });
    });

    it('完了扱いのステータスにしたら完了日時を付け、ステータス更新日時をリセットする', async () => {
      await run();

      const saved = writes.find((w) => w.entity === Task && w.op === 'save')?.args[0] as Row;
      expect(saved.statusCode).toBe('s-done');
      expect(saved.completedAt).toBeInstanceOf(Date);
      expect(saved.statusChangedAt).toBeInstanceOf(Date);
    });

    it('コメントの投稿者は、移動先にいなければ空にする', async () => {
      await run();

      const updates = writes.filter((w) => w.entity === Comment && w.op === 'update');
      const authorOf = (id: string) =>
        (updates.find((u) => (u.args[0] as Row).id === id)?.args[1] as Row).authorMemberId;
      expect(authorOf('c1')).toBe('m-dst-me');
      expect(authorOf('c2')).toBeNull();
    });

    it('関連を切り、通知を移動先の番号に付け替える', async () => {
      await run();

      expect(writes.filter((w) => w.entity === TaskRelation && w.op === 'delete')).toHaveLength(2);
      const notif = writes.find((w) => w.entity === Notification && w.op === 'update');
      expect(notif?.args).toEqual([{ taskId: 'task1' }, { projectId: DST, taskSeq: 58 }]);
    });

    it('変更履歴にプロジェクトと番号の変化を記録し、同じ人への付け替えは記録しない', async () => {
      await run();

      const input = audit.record.mock.calls[0][0];
      const fields = (input.changes ?? []).map((c) => c.field);
      expect(input.action).toBe('update');
      expect(fields).toEqual(expect.arrayContaining(['project', 'seq', 'status', 'tags']));
      expect(fields).not.toContain('assignee');
    });
  });
});
