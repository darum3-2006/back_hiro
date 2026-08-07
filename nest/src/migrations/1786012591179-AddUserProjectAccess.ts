import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ユーザーごとの「閲覧できるプロジェクト」設定を追加する。
 *
 * 以降は明示付与運用（行がなければ見えない）だが、既存の見え方を壊さないよう
 * 既存の 全ユーザー × 同テナントの全プロジェクト をバックフィルで「すべて設定」する。
 */
export class AddUserProjectAccess1786012591179 implements MigrationInterface {
  name = 'AddUserProjectAccess1786012591179';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`user_project_access\` (
        \`id\` varchar(36) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) NULL,
        \`tenant_id\` varchar(36) NOT NULL COMMENT '所属テナント',
        \`user_id\` varchar(36) NOT NULL COMMENT '対象ユーザー',
        \`project_id\` varchar(36) NOT NULL COMMENT '閲覧を許可するプロジェクト',
        UNIQUE INDEX \`uq_user_project_access_user_project\` (\`user_id\`, \`project_id\`),
        INDEX \`idx_user_project_access_project\` (\`project_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB COMMENT='ユーザーが閲覧できるプロジェクト（admin は設定に関係なく全件閲覧可）'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_project_access\` ADD CONSTRAINT \`fk_user_project_access_tenant\`
        FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_project_access\` ADD CONSTRAINT \`fk_user_project_access_user\`
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_project_access\` ADD CONSTRAINT \`fk_user_project_access_project\`
        FOREIGN KEY (\`project_id\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // バックフィル: 既存ユーザー全員に同テナントの全プロジェクトを付与する
    await queryRunner.query(
      `INSERT INTO \`user_project_access\` (\`id\`, \`tenant_id\`, \`user_id\`, \`project_id\`)
        SELECT UUID(), u.\`tenant_id\`, u.\`id\`, p.\`id\`
        FROM \`users\` u
        JOIN \`projects\` p ON p.\`tenant_id\` = u.\`tenant_id\`
        WHERE u.\`deleted_at\` IS NULL AND p.\`deleted_at\` IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`user_project_access\` DROP FOREIGN KEY \`fk_user_project_access_project\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_project_access\` DROP FOREIGN KEY \`fk_user_project_access_user\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`user_project_access\` DROP FOREIGN KEY \`fk_user_project_access_tenant\``,
    );
    await queryRunner.query(`DROP TABLE \`user_project_access\``);
  }
}
