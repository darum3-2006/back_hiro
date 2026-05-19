import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTasks1777970370308 implements MigrationInterface {
  name = 'AddTasks1777970370308';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`tasks\` (\`created_at\` datetime(6) NOT NULL COMMENT '作成日時' DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL COMMENT '更新日時' DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL COMMENT '論理削除日時（NULL=有効）', \`id\` varchar(36) NOT NULL, \`project_id\` varchar(36) NOT NULL COMMENT '所属プロジェクト', \`seq\` int NOT NULL COMMENT 'プロジェクト内連番（表示用）', \`content\` varchar(500) NOT NULL COMMENT '一覧用の概要 / タイトル', \`description\` text NOT NULL COMMENT '詳細説明（Markdown）', \`links\` json NOT NULL COMMENT '関連リンク [{label, url}, ...]', \`status_code\` varchar(64) NOT NULL COMMENT 'ステータスコード', \`priority_code\` varchar(64) NULL COMMENT '優先度コード（NULL = 未設定）', \`assignee_member_id\` varchar(36) NULL COMMENT '担当メンバー（NULL = 未割当）', \`requester_member_id\` varchar(36) NULL COMMENT '起票者メンバー（NULL = 未設定）', \`requesting_dept_code\` varchar(64) NULL COMMENT '起票部署コード（NULL = 未設定）', \`deadline\` date NULL COMMENT '期限', \`planned_completion_date\` date NULL COMMENT '完了予定日', UNIQUE INDEX \`uq_tasks_project_seq\` (\`project_id\`, \`seq\`), INDEX \`idx_tasks_project_deadline\` (\`project_id\`, \`deadline\`), INDEX \`idx_tasks_project_assignee\` (\`project_id\`, \`assignee_member_id\`), INDEX \`idx_tasks_project_priority\` (\`project_id\`, \`priority_code\`), INDEX \`idx_tasks_project_status\` (\`project_id\`, \`status_code\`), INDEX \`idx_tasks_project_created\` (\`project_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB COMMENT="タスク（プロジェクト単位）"`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS \`task_tags\` (\`task_id\` varchar(36) NOT NULL COMMENT 'タスク', \`tag_id\` varchar(36) NOT NULL COMMENT 'タグ', PRIMARY KEY (\`task_id\`, \`tag_id\`)) ENGINE=InnoDB COMMENT="タスクとタグの紐付け"`,
    );
    await queryRunner.query(
      `ALTER TABLE \`task_tags\` ADD CONSTRAINT \`FK_70515bc464901781ac60b82a1ea\` FOREIGN KEY (\`task_id\`) REFERENCES \`tasks\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`task_tags\` ADD CONSTRAINT \`FK_f883135d033e1541f6a81972e7d\` FOREIGN KEY (\`tag_id\`) REFERENCES \`tags\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`tasks\` ADD CONSTRAINT \`FK_9eecdb5b1ed8c7c2a1b392c28d4\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`tasks\` ADD CONSTRAINT \`FK_6986464882b1c808a059425f37d\` FOREIGN KEY (\`assignee_member_id\`) REFERENCES \`project_members\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`tasks\` ADD CONSTRAINT \`FK_ba79db435f613f6b337c6d45069\` FOREIGN KEY (\`requester_member_id\`) REFERENCES \`project_members\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`tasks\` DROP FOREIGN KEY \`FK_ba79db435f613f6b337c6d45069\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`tasks\` DROP FOREIGN KEY \`FK_6986464882b1c808a059425f37d\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`tasks\` DROP FOREIGN KEY \`FK_9eecdb5b1ed8c7c2a1b392c28d4\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`task_tags\` DROP FOREIGN KEY \`FK_f883135d033e1541f6a81972e7d\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`task_tags\` DROP FOREIGN KEY \`FK_70515bc464901781ac60b82a1ea\``,
    );
    await queryRunner.query(`DROP TABLE \`task_tags\``);
    await queryRunner.query(`DROP INDEX \`idx_tasks_project_created\` ON \`tasks\``);
    await queryRunner.query(`DROP INDEX \`idx_tasks_project_status\` ON \`tasks\``);
    await queryRunner.query(`DROP INDEX \`idx_tasks_project_priority\` ON \`tasks\``);
    await queryRunner.query(`DROP INDEX \`idx_tasks_project_assignee\` ON \`tasks\``);
    await queryRunner.query(`DROP INDEX \`idx_tasks_project_deadline\` ON \`tasks\``);
    await queryRunner.query(`DROP INDEX \`uq_tasks_project_seq\` ON \`tasks\``);
    await queryRunner.query(`DROP TABLE \`tasks\``);
  }
}
