import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRefreshTokens1780704000000 implements MigrationInterface {
  name = 'AddRefreshTokens1780704000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`refresh_tokens\` (
        \`id\` varchar(36) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) NULL,
        \`user_id\` varchar(36) NOT NULL COMMENT '対象ユーザー',
        \`token_hash\` varchar(64) NOT NULL COMMENT 'トークンの SHA-256 ハッシュ（hex）。生値は保存しない',
        \`expires_at\` datetime(6) NOT NULL COMMENT '有効期限',
        \`revoked_at\` datetime(6) NULL COMMENT '失効日時（NULL = 有効）。ローテーション/ログアウト/再利用検知でセット',
        UNIQUE INDEX \`uq_refresh_tokens_hash\` (\`token_hash\`),
        INDEX \`idx_refresh_tokens_user\` (\`user_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB COMMENT='リフレッシュトークン（ハッシュのみ保存）'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` ADD CONSTRAINT \`fk_refresh_tokens_user\`
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`refresh_tokens\` DROP FOREIGN KEY \`fk_refresh_tokens_user\``,
    );
    await queryRunner.query(`DROP TABLE \`refresh_tokens\``);
  }
}
