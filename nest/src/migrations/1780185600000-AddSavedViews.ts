import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSavedViews1780185600000 implements MigrationInterface {
  name = 'AddSavedViews1780185600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`saved_views\` (
        \`id\` varchar(36) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) NULL,
        \`project_id\` varchar(36) NOT NULL COMMENT '所属プロジェクト',
        \`owner_user_id\` varchar(36) NULL COMMENT '作成者（NULL = 作成者が削除された孤児ビュー）',
        \`name\` varchar(100) NOT NULL COMMENT 'ビュー表示名',
        \`visibility\` varchar(16) NOT NULL DEFAULT 'private' COMMENT '公開範囲 (private / shared)',
        \`config\` json NOT NULL COMMENT '列/フィルタ/ソート設定一式',
        \`display_order\` int NOT NULL DEFAULT 0 COMMENT '表示順（小さい順）',
        INDEX \`idx_saved_views_project_owner\` (\`project_id\`, \`owner_user_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB COMMENT='保存ビュー（タスク一覧の列/フィルタ/ソート、プロジェクト単位）'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`saved_views\` ADD CONSTRAINT \`fk_saved_views_project\`
        FOREIGN KEY (\`project_id\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`saved_views\` ADD CONSTRAINT \`fk_saved_views_owner\`
        FOREIGN KEY (\`owner_user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`saved_views\` DROP FOREIGN KEY \`fk_saved_views_owner\``);
    await queryRunner.query(
      `ALTER TABLE \`saved_views\` DROP FOREIGN KEY \`fk_saved_views_project\``,
    );
    await queryRunner.query(`DROP TABLE \`saved_views\``);
  }
}
