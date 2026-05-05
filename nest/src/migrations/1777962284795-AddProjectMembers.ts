import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProjectMembers1777962284795 implements MigrationInterface {
    name = 'AddProjectMembers1777962284795'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`project_members\` (\`created_at\` datetime(6) NOT NULL COMMENT '作成日時' DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL COMMENT '更新日時' DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL COMMENT '論理削除日時（NULL=有効）', \`id\` varchar(36) NOT NULL, \`project_id\` varchar(36) NOT NULL COMMENT '所属プロジェクト', \`user_id\` varchar(36) NULL COMMENT '紐づく User（NULL = 表示名のみのフリー入力メンバー）', \`display_name\` varchar(100) NOT NULL COMMENT '表示名', \`role\` varchar(16) NOT NULL COMMENT 'ロール (admin / member)' DEFAULT 'member', UNIQUE INDEX \`uq_project_members_project_user\` (\`project_id\`, \`user_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB COMMENT="プロジェクトメンバー（プロジェクト単位）"`);
        await queryRunner.query(`ALTER TABLE \`project_members\` ADD CONSTRAINT \`FK_b5729113570c20c7e214cf3f58d\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`project_members\` ADD CONSTRAINT \`FK_e89aae80e010c2faa72e6a49ce8\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`project_members\` DROP FOREIGN KEY \`FK_e89aae80e010c2faa72e6a49ce8\``);
        await queryRunner.query(`ALTER TABLE \`project_members\` DROP FOREIGN KEY \`FK_b5729113570c20c7e214cf3f58d\``);
        await queryRunner.query(`DROP INDEX \`uq_project_members_project_user\` ON \`project_members\``);
        await queryRunner.query(`DROP TABLE \`project_members\``);
    }

}
