import type { Member } from '~/types/member';

export const MOCK_MEMBERS: Member[] = [
  // ===== p1: 改修対応 (10 linked + 2 placeholders) =====
  { id: 'm1', projectId: 'p1', displayName: '田中健太', userId: 'u1', role: 'admin' },
  { id: 'm2', projectId: 'p1', displayName: '佐藤美咲', userId: 'u2', role: 'member' },
  { id: 'm3', projectId: 'p1', displayName: '鈴木大輔', userId: 'u3', role: 'admin' },
  { id: 'm4', projectId: 'p1', displayName: '高橋優子', userId: 'u4', role: 'member' },
  { id: 'm5', projectId: 'p1', displayName: '渡辺健二', userId: 'u5', role: 'member' },
  { id: 'm6', projectId: 'p1', displayName: '伊藤葵', userId: 'u6', role: 'member' },
  { id: 'm7', projectId: 'p1', displayName: '山本翔太', userId: 'u7', role: 'member' },
  { id: 'm8', projectId: 'p1', displayName: '中村美穂', userId: 'u8', role: 'member' },
  { id: 'm9', projectId: 'p1', displayName: '小林涼', userId: 'u9', role: 'member' },
  { id: 'm10', projectId: 'p1', displayName: '加藤千尋', userId: 'u10', role: 'member' },
  { id: 'm11', projectId: 'p1', displayName: 'CS（起票）', userId: null, role: 'member' },
  { id: 'm12', projectId: 'p1', displayName: 'かんとく', userId: null, role: 'member' },

  // ===== p2: 新規開発 =====
  { id: 'm13', projectId: 'p2', displayName: '田中健太', userId: 'u1', role: 'admin' },
  { id: 'm14', projectId: 'p2', displayName: '佐藤美咲', userId: 'u2', role: 'member' },
  { id: 'm15', projectId: 'p2', displayName: '鈴木大輔', userId: 'u3', role: 'admin' },
  { id: 'm16', projectId: 'p2', displayName: '高橋優子', userId: 'u4', role: 'member' },
  { id: 'm17', projectId: 'p2', displayName: '渡辺健二', userId: 'u5', role: 'member' },
  { id: 'm18', projectId: 'p2', displayName: '伊藤葵', userId: 'u6', role: 'member' },
  { id: 'm19', projectId: 'p2', displayName: '山本翔太', userId: 'u7', role: 'member' },
  { id: 'm20', projectId: 'p2', displayName: '中村美穂', userId: 'u8', role: 'member' },
  { id: 'm21', projectId: 'p2', displayName: '小林涼', userId: 'u9', role: 'member' },
  { id: 'm22', projectId: 'p2', displayName: '加藤千尋', userId: 'u10', role: 'member' },

  // ===== p3: リファクタリング =====
  { id: 'm23', projectId: 'p3', displayName: '田中健太', userId: 'u1', role: 'admin' },
  { id: 'm24', projectId: 'p3', displayName: '佐藤美咲', userId: 'u2', role: 'member' },
  { id: 'm25', projectId: 'p3', displayName: '鈴木大輔', userId: 'u3', role: 'admin' },
  { id: 'm26', projectId: 'p3', displayName: '高橋優子', userId: 'u4', role: 'member' },
  { id: 'm27', projectId: 'p3', displayName: '渡辺健二', userId: 'u5', role: 'member' },
  { id: 'm28', projectId: 'p3', displayName: '伊藤葵', userId: 'u6', role: 'member' },
  { id: 'm29', projectId: 'p3', displayName: '山本翔太', userId: 'u7', role: 'member' },
  { id: 'm30', projectId: 'p3', displayName: '中村美穂', userId: 'u8', role: 'member' },
  { id: 'm31', projectId: 'p3', displayName: '小林涼', userId: 'u9', role: 'member' },
  { id: 'm32', projectId: 'p3', displayName: '加藤千尋', userId: 'u10', role: 'member' },
];
