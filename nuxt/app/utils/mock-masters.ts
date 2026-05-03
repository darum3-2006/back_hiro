import type { Department, Tag, TaskPriority, TaskStatus, User } from '~/types/master'

export const MOCK_TASK_STATUSES: TaskStatus[] = [
  // p1: 改修対応
  { projectId: 'p1', code: 'todo', label: '未着手', color: 'neutral', order: 1, isTerminal: false },
  {
    projectId: 'p1',
    code: 'in_progress',
    label: '対応中',
    color: 'info',
    order: 2,
    isTerminal: false
  },
  {
    projectId: 'p1',
    code: 'in_review',
    label: 'レビュー中',
    color: 'primary',
    order: 3,
    isTerminal: false
  },
  { projectId: 'p1', code: 'done', label: '完了', color: 'success', order: 4, isTerminal: true },
  {
    projectId: 'p1',
    code: 'on_hold',
    label: '保留',
    color: 'warning',
    order: 5,
    isTerminal: false
  },
  // p2: 新規開発
  { projectId: 'p2', code: 'todo', label: '未着手', color: 'neutral', order: 1, isTerminal: false },
  { projectId: 'p2', code: 'design', label: '設計中', color: 'info', order: 2, isTerminal: false },
  { projectId: 'p2', code: 'dev', label: '実装中', color: 'primary', order: 3, isTerminal: false },
  {
    projectId: 'p2',
    code: 'review',
    label: 'レビュー中',
    color: 'warning',
    order: 4,
    isTerminal: false
  },
  {
    projectId: 'p2',
    code: 'release_ready',
    label: 'リリース待ち',
    color: 'info',
    order: 5,
    isTerminal: false
  },
  { projectId: 'p2', code: 'done', label: '完了', color: 'success', order: 6, isTerminal: true },
  // p3: リファクタリング
  { projectId: 'p3', code: 'todo', label: '未着手', color: 'neutral', order: 1, isTerminal: false },
  { projectId: 'p3', code: 'doing', label: '対応中', color: 'info', order: 2, isTerminal: false },
  { projectId: 'p3', code: 'done', label: '完了', color: 'success', order: 3, isTerminal: true }
]

export const MOCK_TASK_PRIORITIES: TaskPriority[] = [
  // p1
  { projectId: 'p1', code: 'high', label: '高', color: 'error', order: 1 },
  { projectId: 'p1', code: 'mid', label: '中', color: 'warning', order: 2 },
  { projectId: 'p1', code: 'low', label: '低', color: 'neutral', order: 3 },
  // p2
  { projectId: 'p2', code: 'p0', label: 'P0', color: 'error', order: 1 },
  { projectId: 'p2', code: 'p1', label: 'P1', color: 'warning', order: 2 },
  { projectId: 'p2', code: 'p2', label: 'P2', color: 'info', order: 3 },
  { projectId: 'p2', code: 'p3', label: 'P3', color: 'neutral', order: 4 },
  // p3
  { projectId: 'p3', code: 'high', label: '高', color: 'error', order: 1 },
  { projectId: 'p3', code: 'low', label: '低', color: 'neutral', order: 2 }
]

export const MOCK_TAGS: Tag[] = [
  // p1
  { projectId: 'p1', code: 'urgent', name: '緊急対応', color: 'error' },
  { projectId: 'p1', code: 'request', name: '改修要望', color: 'info' },
  { projectId: 'p1', code: 'stable_top', name: '安定期最優先', color: 'warning' },
  { projectId: 'p1', code: 'bugfix', name: 'バグ修正', color: 'primary' },
  { projectId: 'p1', code: 'ui_improve', name: 'UI改善', color: 'neutral' },
  // p2
  { projectId: 'p2', code: 'feature', name: '機能追加', color: 'success' },
  { projectId: 'p2', code: 'spec_change', name: '仕様変更', color: 'warning' },
  { projectId: 'p2', code: 'research', name: 'リサーチ', color: 'info' },
  { projectId: 'p2', code: 'mvp', name: 'MVP', color: 'primary' },
  // p3
  { projectId: 'p3', code: 'cleanup', name: 'コード整理', color: 'neutral' },
  { projectId: 'p3', code: 'tests', name: 'テスト追加', color: 'success' },
  { projectId: 'p3', code: 'deps', name: '依存更新', color: 'info' }
]

export const MOCK_DEPARTMENTS: Department[] = [
  { code: 'biz_dev', name: '事業開発部' },
  { code: 'cs', name: 'カスタマーサポート' },
  { code: 'logistics', name: 'ロジスティクス' },
  { code: 'accounting', name: '経理部' },
  { code: 'marketing', name: 'マーケティング' },
  { code: 'sales', name: '営業部' },
  { code: 'system', name: 'システム部' }
]

export const MOCK_USERS: User[] = [
  { id: 'u1', name: '田中健太', email: 'tanaka@example.com' },
  { id: 'u2', name: '佐藤美咲', email: 'sato@example.com' },
  { id: 'u3', name: '鈴木大輔', email: 'suzuki@example.com' },
  { id: 'u4', name: '高橋優子', email: 'takahashi@example.com' },
  { id: 'u5', name: '渡辺健二', email: 'watanabe@example.com' },
  { id: 'u6', name: '伊藤葵', email: 'ito@example.com' },
  { id: 'u7', name: '山本翔太', email: 'yamamoto@example.com' },
  { id: 'u8', name: '中村美穂', email: 'nakamura@example.com' },
  { id: 'u9', name: '小林涼', email: 'kobayashi@example.com' },
  { id: 'u10', name: '加藤千尋', email: 'kato@example.com' }
]
