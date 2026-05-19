import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectAndDepartment1777947052395 implements MigrationInterface {
  name = 'AddProjectAndDepartment1777947052395';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`projects\` (\`created_at\` datetime(6) NOT NULL COMMENT '作成日時' DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL COMMENT '更新日時' DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL COMMENT '論理削除日時（NULL=有効）', \`id\` varchar(36) NOT NULL, \`tenant_id\` varchar(36) NOT NULL COMMENT '所属テナント', \`key\` varchar(64) NOT NULL COMMENT 'テナント内一意の識別子（URL / 参照用、大文字英数）', \`name\` varchar(255) NOT NULL COMMENT 'プロジェクト名', \`description\` text NULL COMMENT '説明', \`archived_at\` datetime(6) NULL COMMENT 'アーカイブ日時（NULL=有効）', UNIQUE INDEX \`uq_projects_tenant_key\` (\`tenant_id\`, \`key\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB COMMENT="プロジェクト"`,
    );
    await queryRunner.query(
      `CREATE TABLE \`departments\` (\`created_at\` datetime(6) NOT NULL COMMENT '作成日時' DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL COMMENT '更新日時' DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL COMMENT '論理削除日時（NULL=有効）', \`id\` varchar(36) NOT NULL, \`tenant_id\` varchar(36) NOT NULL COMMENT '所属テナント', \`code\` varchar(64) NOT NULL COMMENT '識別コード（テナント内一意）', \`name\` varchar(255) NOT NULL COMMENT '部署名', UNIQUE INDEX \`uq_departments_tenant_code\` (\`tenant_id\`, \`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB COMMENT="部署マスタ（テナント単位）"`,
    );
    await queryRunner.query(
      `ALTER TABLE \`projects\` ADD CONSTRAINT \`FK_7393a03ef67e2ea91b81faa95dd\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`departments\` ADD CONSTRAINT \`FK_146fd7019eea73f8ee7bbb52d4a\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`departments\` DROP FOREIGN KEY \`FK_146fd7019eea73f8ee7bbb52d4a\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`projects\` DROP FOREIGN KEY \`FK_7393a03ef67e2ea91b81faa95dd\``,
    );
    await queryRunner.query(`DROP INDEX \`uq_departments_tenant_code\` ON \`departments\``);
    await queryRunner.query(`DROP TABLE \`departments\``);
    await queryRunner.query(`DROP INDEX \`uq_projects_tenant_key\` ON \`projects\``);
    await queryRunner.query(`DROP TABLE \`projects\``);
  }
}
