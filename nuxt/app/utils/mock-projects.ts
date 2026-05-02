import type { Project } from '~/types/project'

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    key: 'KAISHU',
    name: '改修対応',
    description: 'システム改修・バグ修正を扱う基本プロジェクト'
  },
  {
    id: 'p2',
    key: 'NEW',
    name: '新規開発',
    description: '新機能の企画から実装まで'
  },
  {
    id: 'p3',
    key: 'REF',
    name: 'リファクタリング',
    description: 'コード整理・技術的負債解消'
  }
]
