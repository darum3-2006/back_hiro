import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserApiKey1780099200000 implements MigrationInterface {
  name = 'AddUserApiKey1780099200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`api_key_hash\` varchar(64) NULL COMMENT '公開APIキーの sha256 ハッシュ（平文は保存しない）'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`api_key_prefix\` varchar(16) NULL COMMENT '表示用のキー先頭プレフィックス'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`api_key_created_at\` datetime(6) NULL COMMENT 'APIキー発行日時'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`uq_users_api_key_hash\` ON \`users\` (\`api_key_hash\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`uq_users_api_key_hash\` ON \`users\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`api_key_created_at\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`api_key_prefix\``);
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`api_key_hash\``);
  }
}
