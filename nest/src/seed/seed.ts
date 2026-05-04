import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../data-source';
import { Tenant } from '../tenants/tenant.entity';
import { User } from '../users/user.entity';

const ensureTenant = async (key: string, name: string): Promise<Tenant> => {
  const repo = AppDataSource.getRepository(Tenant);
  let tenant = await repo.findOne({ where: { key } });
  if (!tenant) {
    tenant = await repo.save(repo.create({ key, name }));
    console.log(`[seed] created tenant key=${key}`);
  } else {
    console.log(`[seed] tenant key=${key} already exists, skipped`);
  }
  return tenant;
};

const ensureUser = async (
  tenantId: string,
  email: string,
  name: string,
  password: string,
): Promise<User> => {
  const repo = AppDataSource.getRepository(User);
  let user = await repo.findOne({ where: { tenantId, email } });
  if (!user) {
    const passwordHash = await bcrypt.hash(password, 10);
    user = await repo.save(repo.create({ tenantId, email, name, passwordHash }));
    console.log(`[seed] created user email=${email} (initial password=${password})`);
  } else {
    console.log(`[seed] user email=${email} already exists, skipped`);
  }
  return user;
};

const run = async () => {
  await AppDataSource.initialize();
  console.log('[seed] connected to database');

  const tenant = await ensureTenant('acme', 'Acme Inc.');
  await ensureUser(tenant.id, 'admin@acme.test', 'Admin User', 'admin123');

  await AppDataSource.destroy();
  console.log('[seed] done');
};

run().catch((err: unknown) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
