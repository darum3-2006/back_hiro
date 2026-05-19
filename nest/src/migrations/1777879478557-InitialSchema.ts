import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1777879478557 implements MigrationInterface {
  name = 'InitialSchema1777879478557';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`tenants\` (\`created_at\` datetime(6) NOT NULL COMMENT '作成日時' DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL COMMENT '更新日時' DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL COMMENT '論理削除日時（NULL=有効）', \`id\` varchar(36) NOT NULL, \`key\` varchar(64) NOT NULL COMMENT 'URL 識別子（slug）', \`name\` varchar(255) NOT NULL COMMENT 'テナント表示名', UNIQUE INDEX \`IDX_5c6e46bc16d5b24d9e1e040f11\` (\`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB COMMENT="テナント（契約組織）"`,
    );
    await queryRunner.query(
      `CREATE TABLE \`users\` (\`created_at\` datetime(6) NOT NULL COMMENT '作成日時' DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL COMMENT '更新日時' DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL COMMENT '論理削除日時（NULL=有効）', \`id\` varchar(36) NOT NULL, \`tenant_id\` varchar(36) NOT NULL COMMENT '所属テナント', \`email\` varchar(255) NOT NULL COMMENT 'ログイン用メールアドレス（テナント内一意）', \`password_hash\` varchar(255) NOT NULL COMMENT 'bcrypt パスワードハッシュ', \`name\` varchar(100) NOT NULL COMMENT '表示名', UNIQUE INDEX \`uq_users_tenant_email\` (\`tenant_id\`, \`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB COMMENT="ユーザー（認証アカウント）"`,
    );
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD CONSTRAINT \`FK_109638590074998bb72a2f2cf08\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` DROP FOREIGN KEY \`FK_109638590074998bb72a2f2cf08\``,
    );
    await queryRunner.query(`DROP INDEX \`uq_users_tenant_email\` ON \`users\``);
    await queryRunner.query(`DROP TABLE \`users\``);
    await queryRunner.query(`DROP INDEX \`IDX_5c6e46bc16d5b24d9e1e040f11\` ON \`tenants\``);
    await queryRunner.query(`DROP TABLE \`tenants\``);
  }
}
