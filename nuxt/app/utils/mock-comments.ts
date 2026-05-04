import type { Comment } from '~/types/comment';

export const MOCK_COMMENTS: Comment[] = [
  // Task 1: 商品マスタの一括更新エラー
  {
    id: 1,
    projectId: 'p1',
    taskId: 1,
    authorMemberId: 'm3',
    body: 'バッチ処理化の実装に着手しました。',
    createdAt: '2026-05-01T10:15:00',
    updatedAt: null,
  },
  {
    id: 2,
    projectId: 'p1',
    taskId: 1,
    authorMemberId: 'm1',
    body: '進捗どうでしょうか？',
    createdAt: '2026-05-01T14:00:00',
    updatedAt: null,
  },
  {
    id: 3,
    projectId: 'p1',
    taskId: 1,
    authorMemberId: 'm3',
    body: '5000件で再現確認、修正中です。明日中に PR 出します。',
    createdAt: '2026-05-01T17:30:00',
    updatedAt: null,
  },

  // Task 3: 請求書PDF合計金額
  {
    id: 4,
    projectId: 'p1',
    taskId: 3,
    authorMemberId: 'm8',
    body: 'PR 上げました。レビューお願いします。',
    createdAt: '2026-04-29T11:00:00',
    updatedAt: null,
  },
  {
    id: 5,
    projectId: 'p1',
    taskId: 3,
    authorMemberId: 'm5',
    body: 'ありがとうございます。経理側で数値確認します。',
    createdAt: '2026-04-29T13:20:00',
    updatedAt: null,
  },
  {
    id: 6,
    projectId: 'p1',
    taskId: 3,
    authorMemberId: 'm8',
    body: 'PR レビュー OK、本番反映待ちです。',
    createdAt: '2026-04-30T09:45:00',
    updatedAt: null,
  },

  // Task 4: 会員登録ボタン
  {
    id: 7,
    projectId: 'p1',
    taskId: 4,
    authorMemberId: 'm7',
    body: 'Safari で再現できました。validate 関数の Promise 解決が早すぎる模様。',
    createdAt: '2026-04-30T15:00:00',
    updatedAt: null,
  },
  {
    id: 8,
    projectId: 'p1',
    taskId: 4,
    authorMemberId: 'm6',
    body: 'CS にも進捗を共有しました。',
    createdAt: '2026-04-30T16:10:00',
    updatedAt: null,
  },

  // Task 12: SSL警告
  {
    id: 9,
    projectId: 'p1',
    taskId: 12,
    authorMemberId: 'm3',
    body: 'CDN 設定変更で対応完了。本番反映済みです。',
    createdAt: '2026-04-29T18:00:00',
    updatedAt: null,
  },

  // Task 18: NGワードフィルタ
  {
    id: 10,
    projectId: 'p1',
    taskId: 18,
    authorMemberId: 'm4',
    body: '辞書管理画面の UI モック作成中。',
    createdAt: '2026-04-28T11:00:00',
    updatedAt: null,
  },
  {
    id: 11,
    projectId: 'p1',
    taskId: 18,
    authorMemberId: 'm2',
    body: 'CS 視点で確認したい項目があります。明日打ち合わせさせてください。',
    createdAt: '2026-04-28T14:30:00',
    updatedAt: null,
  },

  // Task 23: ダッシュボードグラフ
  {
    id: 12,
    projectId: 'p1',
    taskId: 23,
    authorMemberId: 'm4',
    body: 'Chrome 更新で CSP ヘッダの要件が変わったのが原因と判明。',
    createdAt: '2026-05-01T10:00:00',
    updatedAt: null,
  },
  {
    id: 13,
    projectId: 'p1',
    taskId: 23,
    authorMemberId: 'm1',
    body: 'デプロイは今日中にしたいです。',
    createdAt: '2026-05-01T11:30:00',
    updatedAt: null,
  },

  // Task 36 (p3): 認証リファクタリング
  {
    id: 14,
    projectId: 'p3',
    taskId: 36,
    authorMemberId: 'm25',
    body: 'Strategy パターンへの整理、80%完了。残りはテストケース追加。',
    createdAt: '2026-04-30T16:00:00',
    updatedAt: null,
  },

  // Task 39 (p1, requester=placeholder m11): CS問い合わせ
  {
    id: 15,
    projectId: 'p1',
    taskId: 39,
    authorMemberId: 'm1',
    body: 'リソース監視ログから候補絞り込み中。14時前後に集中している模様。',
    createdAt: '2026-04-30T18:30:00',
    updatedAt: null,
  },
];
