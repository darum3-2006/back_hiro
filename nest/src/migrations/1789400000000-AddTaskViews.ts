import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * タスクの閲覧履歴（task_views）を追加する。
 * 1 ユーザーあたり直近 30 件だけ残す運用なので、行数はユーザー数 × 30 で頭打ちになる。
 */
export class AddTaskViews1789400000000 implements MigrationInterface {
  name = 'AddTaskViews1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`task_views\` (
        \`id\` varchar(36) NOT NULL,
        \`tenant_id\` varchar(36) NOT NULL COMMENT '所属テナント',
        \`user_id\` varchar(36) NOT NULL COMMENT '閲覧したユーザー',
        \`task_id\` varchar(36) NOT NULL COMMENT '閲覧したタスク',
        \`viewed_at\` datetime(6) NOT NULL COMMENT '最後に開いた日時',
        UNIQUE INDEX \`uq_task_views_user_task\` (\`user_id\`, \`task_id\`),
        INDEX \`idx_task_views_user_viewed\` (\`user_id\`, \`viewed_at\`),
        PRIMARY KEY (\`id\`),
        CONSTRAINT \`fk_task_views_tenant\` FOREIGN KEY (\`tenant_id\`) REFERENCES \`tenants\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_task_views_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_task_views_task\` FOREIGN KEY (\`task_id\`) REFERENCES \`tasks\`(\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB COMMENT='ユーザーごとのタスク閲覧履歴（直近の一定件数だけ保持）'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`task_views\``);
  }
}
