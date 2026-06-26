import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectSlackNotifications1780444800000 implements MigrationInterface {
  name = 'AddProjectSlackNotifications1780444800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`projects\`
        ADD \`slack_webhook_url\` varchar(512) NULL COMMENT 'Slack Incoming Webhook URL（NULL=未設定）。書き込み専用でレスポンスには出さない',
        ADD \`slack_notify_task_created\` tinyint NOT NULL DEFAULT 1 COMMENT 'Slack: 新しいタスクが登録されたとき通知する',
        ADD \`slack_notify_status_changed\` tinyint NOT NULL DEFAULT 1 COMMENT 'Slack: タスクのステータスが変わったとき（完了除く）通知する',
        ADD \`slack_notify_task_completed\` tinyint NOT NULL DEFAULT 1 COMMENT 'Slack: タスクが完了したとき通知する'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`projects\`
        DROP COLUMN \`slack_notify_task_completed\`,
        DROP COLUMN \`slack_notify_status_changed\`,
        DROP COLUMN \`slack_notify_task_created\`,
        DROP COLUMN \`slack_webhook_url\``,
    );
  }
}
