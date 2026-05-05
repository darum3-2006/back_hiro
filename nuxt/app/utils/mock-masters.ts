import type { User } from '~/types/master';

/**
 * Users マスタ（認証ユーザー一覧）。
 * 専用 API がまだ無いので一時的に mock のまま。Step 5+ で /api/users を追加して差し替え予定。
 */
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
  { id: 'u10', name: '加藤千尋', email: 'kato@example.com' },
];
