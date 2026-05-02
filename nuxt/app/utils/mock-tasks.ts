import type { Task } from '~/types/task'

export const MOCK_TASKS: Task[] = [
  // ===== p1: 改修対応 =====
  {
    id: 1, projectId: 'p1',
    content: '商品マスタの一括更新時にエラーが発生する',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyA1' }],
    requesterMemberId: 'm1', requestingDeptCode: 'biz_dev', assigneeMemberId: 'm3',
    priorityCode: 'high', statusCode: 'in_progress',
    deadline: '2026-05-10', plannedCompletionDate: '2026-05-08',
    tagCodes: ['urgent', 'bugfix'],
    description: '一括更新時に5000件超でタイムアウト発生。バッチ処理化を検討中。',
    createdAt: '2026-05-01T09:30:00'
  },
  {
    id: 2, projectId: 'p1',
    content: '在庫数表示の単位がずれている',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyA2' }],
    requesterMemberId: 'm2', requestingDeptCode: 'logistics', assigneeMemberId: 'm4',
    priorityCode: 'mid', statusCode: 'done',
    deadline: '2026-04-25', plannedCompletionDate: '2026-04-23',
    tagCodes: ['bugfix'],
    description: 'ケース単位とピース単位の換算式が逆だった。ホットフィックス済み。',
    createdAt: '2026-04-20T14:12:00'
  },
  {
    id: 3, projectId: 'p1',
    content: '請求書PDFの合計金額が小数点で誤表示',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyA3' }],
    requesterMemberId: 'm5', requestingDeptCode: 'accounting', assigneeMemberId: 'm8',
    priorityCode: 'high', statusCode: 'in_review',
    deadline: '2026-05-05', plannedCompletionDate: '2026-05-04',
    tagCodes: ['urgent', 'bugfix'],
    description: '小数点以下が3桁表示されるケースあり。toFixed(0)で対応。',
    createdAt: '2026-04-28T10:00:00'
  },
  {
    id: 4, projectId: 'p1',
    content: '会員登録フォームの確認ボタンが押せないことがある',
    links: [],
    requesterMemberId: 'm6', requestingDeptCode: 'cs', assigneeMemberId: 'm7',
    priorityCode: 'high', statusCode: 'in_progress',
    deadline: '2026-05-07', plannedCompletionDate: null,
    tagCodes: ['request', 'bugfix'],
    description: 'Safariでのみ再現。validation の発火タイミング要調査。',
    createdAt: '2026-04-29T16:40:00'
  },
  {
    id: 5, projectId: 'p1',
    content: '商品検索の絞り込み条件が反映されない',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyA5' }],
    requesterMemberId: 'm9', requestingDeptCode: 'sales', assigneeMemberId: 'm1',
    priorityCode: 'mid', statusCode: 'todo',
    deadline: '2026-05-15', plannedCompletionDate: null,
    tagCodes: ['request', 'bugfix'],
    description: '価格帯フィルタが OR 条件のままになっている。',
    createdAt: '2026-04-30T11:20:00'
  },
  {
    id: 6, projectId: 'p1',
    content: '発注データのインポート画面でファイルサイズエラー',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyA6' }],
    requesterMemberId: 'm10', requestingDeptCode: 'logistics', assigneeMemberId: 'm3',
    priorityCode: 'mid', statusCode: 'on_hold',
    deadline: null, plannedCompletionDate: null,
    tagCodes: ['request'],
    description: 'インフラチーム確認待ち。本番リソース増強要否検討中。',
    createdAt: '2026-04-22T13:00:00'
  },
  {
    id: 7, projectId: 'p1',
    content: 'メール配信時のテンプレート変数が一部展開されない',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyA7' }],
    requesterMemberId: 'm2', requestingDeptCode: 'marketing', assigneeMemberId: 'm6',
    priorityCode: 'mid', statusCode: 'done',
    deadline: '2026-04-18', plannedCompletionDate: '2026-04-17',
    tagCodes: ['bugfix'],
    description: '{{user.firstName}} が空のときデフォルト値を出すよう修正。',
    createdAt: '2026-04-15T09:00:00'
  },
  {
    id: 8, projectId: 'p1',
    content: '在庫補充アラートのしきい値設定を画面から変更可能に',
    links: [],
    requesterMemberId: 'm5', requestingDeptCode: 'logistics', assigneeMemberId: 'm4',
    priorityCode: 'low', statusCode: 'todo',
    deadline: '2026-06-30', plannedCompletionDate: null,
    tagCodes: ['request', 'stable_top'],
    description: '現状はYAML設定。管理画面化の要望。',
    createdAt: '2026-04-25T15:30:00'
  },
  {
    id: 9, projectId: 'p1',
    content: '印刷帳票のフォントが Mac で崩れる',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyA9' }],
    requesterMemberId: 'm1', requestingDeptCode: 'sales', assigneeMemberId: 'm8',
    priorityCode: 'mid', statusCode: 'in_progress',
    deadline: '2026-05-12', plannedCompletionDate: '2026-05-11',
    tagCodes: ['bugfix'],
    description: 'メイリオ→Noto Sans JP に統一。検証中。',
    createdAt: '2026-04-26T10:00:00'
  },
  {
    id: 10, projectId: 'p1',
    content: 'ログイン履歴の検索が遅い',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyB0' }],
    requesterMemberId: 'm9', requestingDeptCode: 'system', assigneeMemberId: 'm7',
    priorityCode: 'mid', statusCode: 'in_progress',
    deadline: '2026-05-20', plannedCompletionDate: '2026-05-18',
    tagCodes: ['stable_top', 'ui_improve'],
    description: 'インデックス追加とクエリ最適化。',
    createdAt: '2026-04-27T11:00:00'
  },
  {
    id: 11, projectId: 'p1',
    content: '権限グループ編集時に並び順がリセットされる',
    links: [],
    requesterMemberId: 'm10', requestingDeptCode: 'system', assigneeMemberId: 'm1',
    priorityCode: 'low', statusCode: 'todo',
    deadline: '2026-06-10', plannedCompletionDate: null,
    tagCodes: ['bugfix'],
    description: '',
    createdAt: '2026-04-28T16:00:00'
  },
  {
    id: 12, projectId: 'p1',
    content: '商品ページの画像URLがSSL警告を出す',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyB2' }],
    requesterMemberId: 'm6', requestingDeptCode: 'marketing', assigneeMemberId: 'm3',
    priorityCode: 'high', statusCode: 'done',
    deadline: '2026-04-30', plannedCompletionDate: '2026-04-29',
    tagCodes: ['urgent', 'bugfix'],
    description: 'http→https リプレース。画像CDN設定変更で対応。',
    createdAt: '2026-04-26T14:00:00'
  },
  {
    id: 13, projectId: 'p1',
    content: 'キャンペーンコード適用後の合計金額が反映されない',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyB3' }],
    requesterMemberId: 'm2', requestingDeptCode: 'marketing', assigneeMemberId: 'm4',
    priorityCode: 'high', statusCode: 'in_review',
    deadline: '2026-05-06', plannedCompletionDate: '2026-05-05',
    tagCodes: ['urgent', 'bugfix'],
    description: 'カート再計算ロジックの呼び出し漏れ。修正PR提出済み。',
    createdAt: '2026-05-01T10:30:00'
  },
  {
    id: 14, projectId: 'p1',
    content: '予約購入時の決済タイミングを変更したい',
    links: [],
    requesterMemberId: 'm5', requestingDeptCode: 'accounting', assigneeMemberId: 'm8',
    priorityCode: 'mid', statusCode: 'todo',
    deadline: '2026-07-15', plannedCompletionDate: null,
    tagCodes: ['request'],
    description: '出荷時引き落としに変更したい。決済代行とも要相談。',
    createdAt: '2026-04-24T09:00:00'
  },
  {
    id: 15, projectId: 'p1',
    content: 'ユーザーのアバター画像アップロードで形式エラー',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyB5' }],
    requesterMemberId: 'm9', requestingDeptCode: 'cs', assigneeMemberId: 'm7',
    priorityCode: 'low', statusCode: 'done',
    deadline: '2026-04-28', plannedCompletionDate: '2026-04-27',
    tagCodes: ['bugfix'],
    description: 'HEIC ファイルを未対応扱いにし、エラーメッセージ改善。',
    createdAt: '2026-04-22T17:00:00'
  },
  {
    id: 16, projectId: 'p1',
    content: 'セッションタイムアウトが短すぎる',
    links: [],
    requesterMemberId: 'm10', requestingDeptCode: 'sales', assigneeMemberId: 'm6',
    priorityCode: 'mid', statusCode: 'in_progress',
    deadline: '2026-05-14', plannedCompletionDate: null,
    tagCodes: ['ui_improve'],
    description: '30分→2時間に変更検討。セキュリティチームと協議中。',
    createdAt: '2026-04-29T13:30:00'
  },
  {
    id: 17, projectId: 'p1',
    content: 'カレンダーUIの日付選択範囲を限定したい',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyB7' }],
    requesterMemberId: 'm1', requestingDeptCode: 'biz_dev', assigneeMemberId: 'm3',
    priorityCode: 'low', statusCode: 'todo',
    deadline: '2026-06-20', plannedCompletionDate: null,
    tagCodes: ['request', 'ui_improve'],
    description: '',
    createdAt: '2026-04-30T10:00:00'
  },
  {
    id: 18, projectId: 'p1',
    content: '商品レビューにNGワードフィルタを実装',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyB8' }],
    requesterMemberId: 'm2', requestingDeptCode: 'cs', assigneeMemberId: 'm4',
    priorityCode: 'high', statusCode: 'in_progress',
    deadline: '2026-05-13', plannedCompletionDate: '2026-05-12',
    tagCodes: ['request', 'stable_top'],
    description: '辞書はCSV管理。管理画面から追加可能にする予定。',
    createdAt: '2026-04-27T15:00:00'
  },
  {
    id: 19, projectId: 'p1',
    content: '店舗別売上レポートに前年比カラムを追加',
    links: [],
    requesterMemberId: 'm5', requestingDeptCode: 'accounting', assigneeMemberId: 'm8',
    priorityCode: 'mid', statusCode: 'todo',
    deadline: '2026-06-05', plannedCompletionDate: null,
    tagCodes: ['request'],
    description: '',
    createdAt: '2026-04-25T11:00:00'
  },
  {
    id: 20, projectId: 'p1',
    content: '夜間バッチの完了通知が来ないことがある',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyC0' }],
    requesterMemberId: 'm9', requestingDeptCode: 'system', assigneeMemberId: 'm1',
    priorityCode: 'high', statusCode: 'in_review',
    deadline: '2026-05-08', plannedCompletionDate: '2026-05-07',
    tagCodes: ['urgent', 'bugfix'],
    description: 'SNS通知の retry ロジックに問題あり。',
    createdAt: '2026-04-29T20:00:00'
  },
  {
    id: 21, projectId: 'p1',
    content: '外部API連携時の retry 設定を見直し',
    links: [],
    requesterMemberId: 'm10', requestingDeptCode: 'system', assigneeMemberId: 'm7',
    priorityCode: 'mid', statusCode: 'on_hold',
    deadline: null, plannedCompletionDate: null,
    tagCodes: ['stable_top'],
    description: '影響範囲調査中。来月の改修ウィンドウで実施予定。',
    createdAt: '2026-04-23T14:00:00'
  },
  {
    id: 22, projectId: 'p1',
    content: 'FAQページの検索機能を強化',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyC2' }],
    requesterMemberId: 'm6', requestingDeptCode: 'marketing', assigneeMemberId: 'm3',
    priorityCode: 'low', statusCode: 'todo',
    deadline: '2026-07-10', plannedCompletionDate: null,
    tagCodes: ['request'],
    description: '',
    createdAt: '2026-04-26T16:30:00'
  },
  {
    id: 23, projectId: 'p1',
    content: 'ダッシュボードのグラフが表示されない',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyC3' }],
    requesterMemberId: 'm1', requestingDeptCode: 'biz_dev', assigneeMemberId: 'm4',
    priorityCode: 'high', statusCode: 'in_progress',
    deadline: '2026-05-09', plannedCompletionDate: '2026-05-08',
    tagCodes: ['urgent', 'bugfix'],
    description: 'Chrome バージョン更新後に発生。CSP ヘッダ調整で対応中。',
    createdAt: '2026-05-01T08:30:00'
  },
  {
    id: 24, projectId: 'p1',
    content: '複数選択時の一括ステータス変更機能',
    links: [],
    requesterMemberId: 'm2', requestingDeptCode: 'cs', assigneeMemberId: 'm8',
    priorityCode: 'mid', statusCode: 'todo',
    deadline: '2026-06-15', plannedCompletionDate: null,
    tagCodes: ['request', 'ui_improve'],
    description: '',
    createdAt: '2026-04-28T10:30:00'
  },
  {
    id: 25, projectId: 'p1',
    content: 'PDF出力時にロゴ画像が抜ける',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyC5' }],
    requesterMemberId: 'm5', requestingDeptCode: 'sales', assigneeMemberId: 'm6',
    priorityCode: 'mid', statusCode: 'done',
    deadline: '2026-04-29', plannedCompletionDate: '2026-04-28',
    tagCodes: ['bugfix'],
    description: 'wkhtmltopdf のヘッダ設定を修正。',
    createdAt: '2026-04-21T14:00:00'
  },
  {
    id: 26, projectId: 'p1',
    content: 'タグ管理画面で並び順を変更できるようにしたい',
    links: [],
    requesterMemberId: 'm9', requestingDeptCode: 'biz_dev', assigneeMemberId: 'm7',
    priorityCode: 'low', statusCode: 'todo',
    deadline: '2026-07-01', plannedCompletionDate: null,
    tagCodes: ['request', 'ui_improve'],
    description: '',
    createdAt: '2026-04-30T13:00:00'
  },
  {
    id: 27, projectId: 'p1',
    content: '商品CSVエクスポートの文字コードをUTF-8に統一',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyC7' }],
    requesterMemberId: 'm10', requestingDeptCode: 'logistics', assigneeMemberId: 'm1',
    priorityCode: 'mid', statusCode: 'in_review',
    deadline: '2026-05-11', plannedCompletionDate: '2026-05-10',
    tagCodes: ['request'],
    description: 'BOM 付与有無のオプションも追加。',
    createdAt: '2026-04-26T11:00:00'
  },
  {
    id: 28, projectId: 'p1',
    content: '会員ランクの自動更新ロジックを再検討',
    links: [],
    requesterMemberId: 'm6', requestingDeptCode: 'marketing', assigneeMemberId: 'm3',
    priorityCode: 'mid', statusCode: 'on_hold',
    deadline: null, plannedCompletionDate: null,
    tagCodes: ['request'],
    description: '事業企画と仕様検討中。',
    createdAt: '2026-04-24T15:30:00'
  },
  {
    id: 29, projectId: 'p1',
    content: 'カート追加時のフィードバックが出ない',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyC9' }],
    requesterMemberId: 'm1', requestingDeptCode: 'marketing', assigneeMemberId: 'm4',
    priorityCode: 'mid', statusCode: 'done',
    deadline: '2026-04-26', plannedCompletionDate: '2026-04-25',
    tagCodes: ['ui_improve', 'bugfix'],
    description: 'Toast通知を追加。',
    createdAt: '2026-04-20T16:00:00'
  },
  {
    id: 30, projectId: 'p1',
    content: '住所入力フォームを郵便番号オートコンプリート対応',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyD0' }],
    requesterMemberId: 'm2', requestingDeptCode: 'cs', assigneeMemberId: 'm8',
    priorityCode: 'low', statusCode: 'todo',
    deadline: '2026-06-25', plannedCompletionDate: null,
    tagCodes: ['request', 'ui_improve'],
    description: '',
    createdAt: '2026-04-29T09:30:00'
  },
  // ===== 起票者がプレースホルダ Member（User未紐付け） =====
  {
    id: 39, projectId: 'p1',
    content: '注文画面の応答が遅いという問い合わせが複数件',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyD9' }],
    requesterMemberId: 'm11', requestingDeptCode: 'cs', assigneeMemberId: 'm1',
    priorityCode: 'high', statusCode: 'in_progress',
    deadline: '2026-05-08', plannedCompletionDate: '2026-05-07',
    tagCodes: ['urgent', 'stable_top'],
    description: 'CS のお問い合わせ集計から検出。リソース監視を強化中。',
    createdAt: '2026-04-30T17:00:00'
  },
  {
    id: 40, projectId: 'p1',
    content: 'マーケ施策効果計測ダッシュボードに前日比カラムを追加',
    links: [],
    requesterMemberId: 'm12', requestingDeptCode: 'marketing', assigneeMemberId: 'm9',
    priorityCode: 'mid', statusCode: 'todo',
    deadline: '2026-05-30', plannedCompletionDate: null,
    tagCodes: ['request'],
    description: '監督からの依頼。仕様すり合わせ予定。',
    createdAt: '2026-04-28T11:00:00'
  },
  // ===== p2: 新規開発 =====
  {
    id: 31, projectId: 'p2',
    content: '新ユーザー権限管理機能の設計',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyD1' }],
    requesterMemberId: 'm13', requestingDeptCode: 'biz_dev', assigneeMemberId: 'm15',
    priorityCode: 'p1', statusCode: 'design',
    deadline: '2026-05-30', plannedCompletionDate: '2026-05-25',
    tagCodes: ['feature', 'mvp'],
    description: 'ロールベース vs ABAC を比較検討中。',
    createdAt: '2026-04-15T10:00:00'
  },
  {
    id: 32, projectId: 'p2',
    content: 'モバイルアプリ初期 MVP のリサーチ',
    links: [],
    requesterMemberId: 'm21', requestingDeptCode: 'biz_dev', assigneeMemberId: 'm19',
    priorityCode: 'p2', statusCode: 'todo',
    deadline: '2026-06-15', plannedCompletionDate: null,
    tagCodes: ['research', 'mvp'],
    description: 'iOS / Android のフレームワーク比較から。',
    createdAt: '2026-04-28T14:00:00'
  },
  {
    id: 33, projectId: 'p2',
    content: '通知センターの実装',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyD3' }],
    requesterMemberId: 'm14', requestingDeptCode: 'biz_dev', assigneeMemberId: 'm16',
    priorityCode: 'p0', statusCode: 'dev',
    deadline: '2026-05-22', plannedCompletionDate: '2026-05-20',
    tagCodes: ['feature'],
    description: 'リアルタイム通知は WebSocket 採用予定。',
    createdAt: '2026-04-18T09:30:00'
  },
  {
    id: 34, projectId: 'p2',
    content: '検索機能のシノニム対応',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyD4' }],
    requesterMemberId: 'm17', requestingDeptCode: 'marketing', assigneeMemberId: 'm20',
    priorityCode: 'p1', statusCode: 'review',
    deadline: '2026-05-15', plannedCompletionDate: '2026-05-13',
    tagCodes: ['feature'],
    description: '辞書管理画面の UI レビュー中。',
    createdAt: '2026-04-22T11:00:00'
  },
  {
    id: 35, projectId: 'p2',
    content: 'ダッシュボード v2 の仕様策定',
    links: [],
    requesterMemberId: 'm18', requestingDeptCode: 'biz_dev', assigneeMemberId: 'm13',
    priorityCode: 'p1', statusCode: 'design',
    deadline: '2026-05-28', plannedCompletionDate: null,
    tagCodes: ['feature', 'spec_change'],
    description: 'ウィジェット方式に変更を提案中。',
    createdAt: '2026-04-26T13:00:00'
  },
  // ===== p3: リファクタリング =====
  {
    id: 36, projectId: 'p3',
    content: '認証モジュールのリファクタリング',
    links: [{ label: 'Trello', url: 'https://trello.com/c/dummyE1' }],
    requesterMemberId: 'm31', requestingDeptCode: 'system', assigneeMemberId: 'm25',
    priorityCode: 'high', statusCode: 'doing',
    deadline: '2026-05-25', plannedCompletionDate: '2026-05-22',
    tagCodes: ['cleanup'],
    description: 'Strategy パターンに整理。テストカバレッジも引き上げ予定。',
    createdAt: '2026-04-25T15:00:00'
  },
  {
    id: 37, projectId: 'p3',
    content: 'モノリポ依存関係を最新化',
    links: [],
    requesterMemberId: 'm32', requestingDeptCode: 'system', assigneeMemberId: 'm29',
    priorityCode: 'low', statusCode: 'todo',
    deadline: '2026-06-30', plannedCompletionDate: null,
    tagCodes: ['deps'],
    description: 'major バージョンアップは個別検討。',
    createdAt: '2026-04-20T10:00:00'
  },
  {
    id: 38, projectId: 'p3',
    content: '統合テストの整備',
    links: [],
    requesterMemberId: 'm31', requestingDeptCode: 'system', assigneeMemberId: 'm26',
    priorityCode: 'high', statusCode: 'todo',
    deadline: '2026-06-10', plannedCompletionDate: null,
    tagCodes: ['tests'],
    description: 'Playwright で主要シナリオを自動化。',
    createdAt: '2026-04-29T11:30:00'
  }
]
