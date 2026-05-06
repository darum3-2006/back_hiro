# migrate-xlsx

スプレッドシート (`.xlsx`) → DB への一回限り移行 CLI。

## 配置

`scripts/migrate-xlsx/` 配下に閉じており、`src/`（production）には含まない。
`xlsx` パッケージは devDependencies なので、production ビルドにも入らない。

## 使い方

```bash
# まずは dry-run でシート構造を確認
pnpm migrate:xlsx ~/Downloads/システム改修対応一覧.xlsx \
  --tenant-key=acme --project-key=KAISYU --dry-run

# 列マッピング確定後に本投入
pnpm migrate:xlsx ~/Downloads/システム改修対応一覧.xlsx \
  --tenant-key=acme --project-key=KAISYU
```

## 動作

1. `xlsx` パッケージで Workbook をパース
2. `--dry-run` のときは先頭シートの 5 行だけ `normalizeRow` に通して確認、DB は触らない
3. 本投入時は `NestFactory.createApplicationContext(AppModule)` で Service を借用
4. Tenant / Project / 初期マスタ (Status / Priority) を作成 or 流用
5. Member / Task / Comment は列マッピング確定後に追加実装（現状 TODO）

## 列マッピング

`scripts/migrate-xlsx/mapping.ts` の `SheetTaskRow` と `parser.ts` の `normalizeRow` を、
実 xlsx のヘッダ名に合わせて埋める。

## 注意

- production の dist には入らない（`tsconfig.build.json` で `src/` のみコンパイル対象）
- 直接 Repository を触らず、必ず Service 経由で投入する（バリデーション/不変条件を保つため）
- 実行は `ts-node` で `.ts` を直接走らせる（`pnpm typeorm` と同じ流儀）
