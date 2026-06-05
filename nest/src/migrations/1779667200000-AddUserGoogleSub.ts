import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserGoogleSub1779667200000 implements MigrationInterface {
  name = 'AddUserGoogleSub1779667200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`google_sub\` varchar(255) NULL COMMENT 'Google SSO の subject（sub）。連携済みユーザのみ値を持つ'`,
    );
    // 同一 Google アカウントを別テナントのユーザにも紐づけられるよう、テナント内一意。
    // NULL（連携前）は重複可能なので既存ユーザに影響しない。
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`uq_users_tenant_google_sub\` ON \`users\` (\`tenant_id\`, \`google_sub\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`uq_users_tenant_google_sub\` ON \`users\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`google_sub\``);
  }
}
