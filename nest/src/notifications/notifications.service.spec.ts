import { BadRequestException } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import type { AuditChange } from '../audit/audit-log.entity';
import { ProjectMember } from '../members/member.entity';
import type { Task } from '../tasks/task.entity';
import { NotificationPreference } from './notification-preference.entity';
import { Notification } from './notification.entity';
import { NotificationsService } from './notifications.service';

const makeTask = (over: Partial<Task> = {}): Task =>
  ({
    id: 't1',
    projectId: 'p1',
    seq: 1,
    content: 'テストタスク',
    assigneeMemberId: null,
    requesterMemberId: null,
    ...over,
  }) as Task;

describe('NotificationsService', () => {
  let service: NotificationsService;
  let notifications: jest.Mocked<Pick<Repository<Notification>, 'create' | 'save' | 'find'>>;
  let prefs: jest.Mocked<
    Pick<Repository<NotificationPreference>, 'find' | 'findOne' | 'save' | 'create'>
  >;
  let members: jest.Mocked<Pick<Repository<ProjectMember>, 'find' | 'findOne'>>;

  /** save された通知を {userId, type} で集める */
  const savedNotifs = () =>
    notifications.save.mock.calls.map((c) => {
      const n = c[0] as Notification;
      return { userId: n.userId, type: n.type };
    });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getRepositoryToken(Notification),
          useValue: {
            create: jest.fn((dto: Partial<Notification>) => dto as Notification),
            save: jest.fn((e: Notification) => Promise.resolve({ ...e, id: 'n' })),
            find: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(NotificationPreference),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            save: jest.fn((e: NotificationPreference) => Promise.resolve(e)),
            create: jest.fn(
              (dto: Partial<NotificationPreference>) => dto as NotificationPreference,
            ),
          },
        },
        {
          provide: getRepositoryToken(ProjectMember),
          useValue: { find: jest.fn(), findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(NotificationsService);
    notifications = module.get(getRepositoryToken(Notification));
    prefs = module.get(getRepositoryToken(NotificationPreference));
    members = module.get(getRepositoryToken(ProjectMember));
  });

  describe('getPreferences', () => {
    it('未設定は全タイプ既定 ON で返す', async () => {
      prefs.find.mockResolvedValue([]);
      const result = await service.getPreferences('u1');
      expect(result).toHaveLength(4);
      expect(result.every((p) => p.enabled)).toBe(true);
      expect(result.map((p) => p.type)).toEqual([
        'task_created',
        'assigned',
        'status_changed',
        'mentioned',
      ]);
    });

    it('上書き行があれば反映する', async () => {
      prefs.find.mockResolvedValue([
        { userId: 'u1', type: 'task_created', enabled: false } as NotificationPreference,
      ]);
      const result = await service.getPreferences('u1');
      expect(result.find((p) => p.type === 'task_created')?.enabled).toBe(false);
      expect(result.find((p) => p.type === 'assigned')?.enabled).toBe(true);
    });
  });

  describe('setPreference', () => {
    it('未知タイプは BadRequest', async () => {
      await expect(service.setPreference('u1', 'unknown', false)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('onTaskCreated', () => {
    it('担当者には assigned、他メンバーには task_created、操作者と未紐付けは除外', async () => {
      members.findOne.mockResolvedValue({ userId: 'u-assignee' } as ProjectMember);
      members.find.mockResolvedValue([
        { userId: 'u-assignee' },
        { userId: 'u-other' },
        { userId: 'u-actor' },
        { userId: null },
      ] as ProjectMember[]);

      await service.onTaskCreated('tnt', makeTask({ assigneeMemberId: 'm-a' }), 'u-actor');

      const saved = savedNotifs();
      expect(saved).toContainEqual({ userId: 'u-assignee', type: 'assigned' });
      expect(saved).toContainEqual({ userId: 'u-other', type: 'task_created' });
      // 操作者・担当者(task_created)・未紐付けは含まれない
      expect(saved.find((s) => s.userId === 'u-actor')).toBeUndefined();
      expect(saved).not.toContainEqual({ userId: 'u-assignee', type: 'task_created' });
    });
  });

  describe('onTaskChanged', () => {
    const statusChange: AuditChange[] = [
      { field: 'status', old: 'todo', new: 'done', newLabel: '完了' },
    ];

    it('ステータス変更で担当＋起票に status_changed（操作者除外・重複除外）', async () => {
      members.findOne.mockImplementation((opts) => {
        const id = (opts as { where: { id: string } }).where.id;
        if (id === 'm-a') return Promise.resolve({ userId: 'u-a' } as ProjectMember);
        if (id === 'm-r') return Promise.resolve({ userId: 'u-r' } as ProjectMember);
        return Promise.resolve(null);
      });

      await service.onTaskChanged(
        'tnt',
        makeTask({ assigneeMemberId: 'm-a', requesterMemberId: 'm-r' }),
        statusChange,
        'u-actor',
      );

      const saved = savedNotifs();
      expect(saved).toContainEqual({ userId: 'u-a', type: 'status_changed' });
      expect(saved).toContainEqual({ userId: 'u-r', type: 'status_changed' });
      expect(saved).toHaveLength(2);
    });

    it('担当が操作者自身なら status_changed を送らない', async () => {
      members.findOne.mockImplementation((opts) => {
        const id = (opts as { where: { id: string } }).where.id;
        if (id === 'm-a') return Promise.resolve({ userId: 'u-actor' } as ProjectMember);
        return Promise.resolve(null);
      });

      await service.onTaskChanged(
        'tnt',
        makeTask({ assigneeMemberId: 'm-a', requesterMemberId: null }),
        statusChange,
        'u-actor',
      );

      expect(savedNotifs()).toHaveLength(0);
    });

    it('担当者変更で新担当に assigned', async () => {
      members.findOne.mockResolvedValue({ userId: 'u-new' } as ProjectMember);

      await service.onTaskChanged(
        'tnt',
        makeTask({ assigneeMemberId: 'm-new' }),
        [{ field: 'assignee', old: null, new: 'm-new' }],
        'u-actor',
      );

      expect(savedNotifs()).toContainEqual({ userId: 'u-new', type: 'assigned' });
    });

    it('OFF 設定のユーザーには配信しない', async () => {
      members.findOne.mockResolvedValue({ userId: 'u-a' } as ProjectMember);
      prefs.find.mockResolvedValue([
        { userId: 'u-a', type: 'status_changed', enabled: false } as NotificationPreference,
      ]);

      await service.onTaskChanged(
        'tnt',
        makeTask({ assigneeMemberId: 'm-a', requesterMemberId: null }),
        statusChange,
        'u-actor',
      );

      expect(savedNotifs()).toHaveLength(0);
    });
  });
});
