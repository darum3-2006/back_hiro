/**
 * テナント追加 CLI（テナント本体 + 最初の admin ユーザーを同時作成）。
 *
 * 使い方:
 *   pnpm admin:create-tenant \
 *     --tenant-key=foo --tenant-name="Foo Inc." \
 *     --admin-email=admin@foo.example --admin-name="Admin" --admin-password=changeme123
 *
 * 設計方針:
 *   - production コード (src/) には依存するが、CLI 自体は scripts/ に閉じる
 *   - NestFactory.createApplicationContext で AppModule を起動 → Service 経由で投入
 *   - パスワードは引数で受け取る簡易実装（CI 等で安全に渡す前提）
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../src/app.module';
import { TenantsService } from '../../src/tenants/tenants.service';
import { UsersService } from '../../src/users/users.service';

interface CliArgs {
  tenantKey: string;
  tenantName: string;
  adminEmail: string;
  adminName: string;
  adminPassword: string;
}

const parseArgs = (argv: string[]): CliArgs => {
  const map: Record<string, string> = {};
  for (const a of argv) {
    const m = /^--([\w-]+)=(.*)$/.exec(a);
    if (m) map[m[1]] = m[2];
  }
  const required = ['tenant-key', 'tenant-name', 'admin-email', 'admin-name', 'admin-password'];
  for (const k of required) {
    if (!map[k]) {
      throw new Error(
        `Usage: pnpm admin:create-tenant --tenant-key=<key> --tenant-name=<name> --admin-email=<email> --admin-name=<name> --admin-password=<password>`,
      );
    }
  }
  return {
    tenantKey: map['tenant-key'],
    tenantName: map['tenant-name'],
    adminEmail: map['admin-email'],
    adminName: map['admin-name'],
    adminPassword: map['admin-password'],
  };
};

const run = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  console.log(`[admin] creating tenant key=${args.tenantKey} name=${args.tenantName}`);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const tenants = app.get(TenantsService);
    const users = app.get(UsersService);

    const tenant = await tenants.create({ key: args.tenantKey, name: args.tenantName });
    console.log(`[admin] created tenant: ${tenant.id} (key=${tenant.key})`);

    const user = await users.create(tenant.id, {
      email: args.adminEmail,
      name: args.adminName,
      password: args.adminPassword,
      role: 'admin',
    });
    console.log(`[admin] created admin user: ${user.id} (${user.email})`);
    console.log(`\nログイン情報:`);
    console.log(`  URL:      http://localhost:8100/${tenant.key}/login`);
    console.log(`  email:    ${user.email}`);
    console.log(`  password: ${args.adminPassword}`);
  } finally {
    await app.close();
  }
};

run().catch((err: unknown) => {
  console.error('[admin] failed:', err);
  process.exit(1);
});
