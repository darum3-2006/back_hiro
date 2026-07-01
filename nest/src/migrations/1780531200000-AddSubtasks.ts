import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubtasks1780531200000 implements MigrationInterface {
  name = 'AddSubtasks1780531200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`subtasks\` (
        \`id\` varchar(36) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) NULL,
        \`project_id\` varchar(36) NOT NULL COMMENT '所属プロジェクト',
        \`task_id\` varchar(36) NOT NULL COMMENT '親タスク',
        \`title\` varchar(255) NOT NULL COMMENT 'サブタスク名',
        \`assignee_member_id\` varchar(36) NULL COMMENT '担当メンバー（NULL = 未割当）',
        \`deadline\` date NULL COMMENT '期限',
        \`memo\` text NULL COMMENT 'メモ（Markdown）',
        \`done\` tinyint NOT NULL DEFAULT 0 COMMENT '完了フラグ',
        \`completed_at\` datetime(6) NULL COMMENT '完了にした日時（done の間だけ値を持つ）',
        \`position\` int NOT NULL COMMENT '親タスク内の並び順',
        INDEX \`idx_subtasks_task_position\` (\`task_id\`, \`position\`),
        INDEX \`idx_subtasks_project_deadline\` (\`project_id\`, \`deadline\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB COMMENT='サブタスク（親タスクを束ね役にした軽量な作業単位）'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`subtasks\` ADD CONSTRAINT \`fk_subtasks_project\`
        FOREIGN KEY (\`project_id\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`subtasks\` ADD CONSTRAINT \`fk_subtasks_task\`
        FOREIGN KEY (\`task_id\`) REFERENCES \`tasks\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`subtasks\` ADD CONSTRAINT \`fk_subtasks_assignee_member\`
        FOREIGN KEY (\`assignee_member_id\`) REFERENCES \`project_members\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`subtasks\` DROP FOREIGN KEY \`fk_subtasks_assignee_member\``,
    );
    await queryRunner.query(`ALTER TABLE \`subtasks\` DROP FOREIGN KEY \`fk_subtasks_task\``);
    await queryRunner.query(`ALTER TABLE \`subtasks\` DROP FOREIGN KEY \`fk_subtasks_project\``);
    await queryRunner.query(`DROP TABLE \`subtasks\``);
  }
}
