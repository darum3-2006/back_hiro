import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotifications1780358400000 implements MigrationInterface {
  name = 'AddNotifications1780358400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`notifications\` (
        \`id\` varchar(36) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) NULL,
        \`tenant_id\` varchar(36) NOT NULL COMMENT '所属テナント',
        \`user_id\` varchar(36) NOT NULL COMMENT '受信者（User）',
        \`type\` varchar(64) NOT NULL COMMENT '通知タイプ（assigned 等）',
        \`project_id\` varchar(36) NULL COMMENT '関連プロジェクト',
        \`task_id\` varchar(36) NULL COMMENT '関連タスク',
        \`task_seq\` int NULL COMMENT '関連タスクのプロジェクト内連番（リンク/表示用 #N）',
        \`actor_user_id\` varchar(36) NULL COMMENT '通知の原因となった操作者（NULL = システム）',
        \`message\` varchar(500) NOT NULL COMMENT '表示メッセージ',
        \`read_at\` datetime NULL COMMENT '既読日時（NULL = 未読）',
        INDEX \`idx_notifications_user\` (\`tenant_id\`, \`user_id\`, \`created_at\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB COMMENT='アプリ内通知（受信者ごと 1 レコード）'`,
    );
    await queryRunner.query(
      `CREATE TABLE \`notification_preferences\` (
        \`id\` varchar(36) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) NULL,
        \`user_id\` varchar(36) NOT NULL COMMENT '対象ユーザー',
        \`type\` varchar(64) NOT NULL COMMENT '通知タイプ',
        \`enabled\` tinyint NOT NULL COMMENT '有効か（false = この通知を受け取らない）',
        UNIQUE INDEX \`uq_notification_prefs_user_type\` (\`user_id\`, \`type\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB COMMENT='ユーザーごとの通知 ON/OFF 設定'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`notification_preferences\``);
    await queryRunner.query(`DROP TABLE \`notifications\``);
  }
}
