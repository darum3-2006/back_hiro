# admin scripts

テナント追加など、運用初期に CLI から行う管理操作。

## 配置

`scripts/admin/` 配下に閉じており、`src/`（production）には含まない。
`tsconfig.build.json` で除外済みなので `nest build` でも `dist/` に入らない。

## 使い方

### create-tenant — テナント新規作成 + 最初の admin ユーザー追加

```bash
pnpm admin:create-tenant \
  --tenant-key=foo \
  --tenant-name="Foo Inc." \
  --admin-email=admin@foo.example \
  --admin-name="Foo Admin" \
  --admin-password=changeme123
```

- `tenant-key` は URL パスに使われるテナント識別子。小文字英数字推奨
- `tenant-name` は表示用
- `admin-*` は同時に作成するテナント管理者ユーザー
- パスワードは 8〜72 文字
