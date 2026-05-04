# back_hiro / Frontend

Nuxt 4 + Nuxt UI 4 + Tailwind 4 のフロントエンド。

## 必要環境

- Node 22+
- pnpm 10+（`corepack enable` で有効化、`packageManager` フィールド準拠）

## セットアップ

```bash
pnpm install
```

## コマンド

```bash
pnpm dev          # 開発サーバー（http://localhost:3000）
pnpm build        # 本番ビルド
pnpm preview      # 本番ビルドのプレビュー
pnpm lint         # ESLint
pnpm lint:fix     # ESLint 自動修正
pnpm format       # Prettier 整形
pnpm format:check # 整形チェック（CI 用）
pnpm typecheck    # vue-tsc
```

## ディレクトリ構成

```
app/
├── api/         ★ バックエンド差し替えポイント（現在モック実装）
├── composables/ useAsyncData ラッパー
├── components/  共通コンポーネント
├── pages/       ルーティング
├── types/       型定義
└── utils/       モックデータ・ユーティリティ
```

## バックエンド接続時の差し替え

`app/api/*.ts` の各関数を実 API 呼び出しに置換するだけで、composable / コンポーネント側は無変更で動作する設計。

```ts
// Before（モック）
export const fetchTasks = async (projectId: string): Promise<Task[]> => {
  return MOCK_TASKS.filter((t) => t.projectId === projectId);
};

// After（バックエンド接続）
export const fetchTasks = async (projectId: string): Promise<Task[]> => {
  return await $fetch<Task[]>(`/api/projects/${projectId}/tasks`);
};
```

各関数の JSDoc に対応するエンドポイント（例: `GET /projects/{id}/tasks`）を明記済み。

## ドキュメント

- 設計概要: [../docs/PROJECT.md](../docs/PROJECT.md)
- コーディング規約: [../docs/CONVENTIONS.md](../docs/CONVENTIONS.md)
