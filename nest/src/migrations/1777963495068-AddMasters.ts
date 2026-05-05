import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMasters1777963495068 implements MigrationInterface {
    name = 'AddMasters1777963495068'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`task_statuses\` (\`created_at\` datetime(6) NOT NULL COMMENT '作成日時' DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL COMMENT '更新日時' DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL COMMENT '論理削除日時（NULL=有効）', \`id\` varchar(36) NOT NULL, \`project_id\` varchar(36) NOT NULL COMMENT '所属プロジェクト', \`code\` varchar(64) NOT NULL COMMENT '識別コード（プロジェクト内一意）', \`label\` varchar(100) NOT NULL COMMENT '表示ラベル', \`color\` varchar(16) NOT NULL COMMENT '表示色', \`display_order\` int NOT NULL COMMENT '表示順（小さい順）', \`is_terminal\` tinyint NOT NULL COMMENT '終了状態（true=完了扱い）' DEFAULT '0', UNIQUE INDEX \`uq_task_statuses_project_code\` (\`project_id\`, \`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB COMMENT="タスクステータス（プロジェクト単位）"`);
        await queryRunner.query(`CREATE TABLE \`task_priorities\` (\`created_at\` datetime(6) NOT NULL COMMENT '作成日時' DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL COMMENT '更新日時' DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL COMMENT '論理削除日時（NULL=有効）', \`id\` varchar(36) NOT NULL, \`project_id\` varchar(36) NOT NULL COMMENT '所属プロジェクト', \`code\` varchar(64) NOT NULL COMMENT '識別コード（プロジェクト内一意）', \`label\` varchar(100) NOT NULL COMMENT '表示ラベル', \`color\` varchar(16) NOT NULL COMMENT '表示色', \`display_order\` int NOT NULL COMMENT '表示順（小さい順）', UNIQUE INDEX \`uq_task_priorities_project_code\` (\`project_id\`, \`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB COMMENT="タスク優先度（プロジェクト単位）"`);
        await queryRunner.query(`CREATE TABLE \`tags\` (\`created_at\` datetime(6) NOT NULL COMMENT '作成日時' DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL COMMENT '更新日時' DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL COMMENT '論理削除日時（NULL=有効）', \`id\` varchar(36) NOT NULL, \`project_id\` varchar(36) NOT NULL COMMENT '所属プロジェクト', \`code\` varchar(64) NOT NULL COMMENT '識別コード（プロジェクト内一意）', \`name\` varchar(100) NOT NULL COMMENT 'タグ名', \`color\` varchar(16) NOT NULL COMMENT '表示色', UNIQUE INDEX \`uq_tags_project_code\` (\`project_id\`, \`code\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB COMMENT="タスクタグ（プロジェクト単位）"`);
        await queryRunner.query(`ALTER TABLE \`task_statuses\` ADD CONSTRAINT \`FK_1918c92dc3fb9fd3b0df2e6a7e4\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`task_priorities\` ADD CONSTRAINT \`FK_90cb292b1088ae8027d5843edef\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`tags\` ADD CONSTRAINT \`FK_7ab852bb0ada09a0fc3adb7e5de\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`tags\` DROP FOREIGN KEY \`FK_7ab852bb0ada09a0fc3adb7e5de\``);
        await queryRunner.query(`ALTER TABLE \`task_priorities\` DROP FOREIGN KEY \`FK_90cb292b1088ae8027d5843edef\``);
        await queryRunner.query(`ALTER TABLE \`task_statuses\` DROP FOREIGN KEY \`FK_1918c92dc3fb9fd3b0df2e6a7e4\``);
        await queryRunner.query(`DROP INDEX \`uq_tags_project_code\` ON \`tags\``);
        await queryRunner.query(`DROP TABLE \`tags\``);
        await queryRunner.query(`DROP INDEX \`uq_task_priorities_project_code\` ON \`task_priorities\``);
        await queryRunner.query(`DROP TABLE \`task_priorities\``);
        await queryRunner.query(`DROP INDEX \`uq_task_statuses_project_code\` ON \`task_statuses\``);
        await queryRunner.query(`DROP TABLE \`task_statuses\``);
    }

}
