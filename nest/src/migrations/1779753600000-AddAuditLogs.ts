import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAuditLogs1779753600000 implements MigrationInterface {
  name = 'AddAuditLogs1779753600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`audit_logs\` (
        \`id\` varchar(36) NOT NULL,
        \`tenant_id\` varchar(36) NOT NULL COMMENT '所属テナント',
        \`entity_type\` varchar(32) NOT NULL COMMENT '対象種別（task 等）',
        \`entity_id\` varchar(36) NOT NULL COMMENT '対象エンティティ ID',
        \`project_id\` varchar(36) NULL COMMENT '所属プロジェクト（横断フィード用 / NULL = プロジェクト外）',
        \`action\` varchar(16) NOT NULL COMMENT '操作種別（create/update/delete/restore）',
        \`changes\` json NULL COMMENT '変更内容 [{field, old, new, oldLabel, newLabel}]（create/delete は NULL 可）',
        \`actor_user_id\` varchar(36) NULL COMMENT '操作した User（退会で SET NULL / システム操作は NULL）',
        \`actor_user_name\` varchar(255) NULL COMMENT '操作者の表示名スナップショット（記録時点）',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) COMMENT '記録日時',
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB COMMENT='監査ログ（追記専用）'`,
    );
    // エンティティ別タイムライン（タスク詳細の履歴）用
    await queryRunner.query(
      `CREATE INDEX \`idx_audit_entity\` ON \`audit_logs\` (\`tenant_id\`, \`entity_type\`, \`entity_id\`, \`created_at\`)`,
    );
    // プロジェクト全体の活動フィード用
    await queryRunner.query(
      `CREATE INDEX \`idx_audit_project\` ON \`audit_logs\` (\`tenant_id\`, \`project_id\`, \`created_at\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`idx_audit_project\` ON \`audit_logs\``);
    await queryRunner.query(`DROP INDEX \`idx_audit_entity\` ON \`audit_logs\``);
    await queryRunner.query(`DROP TABLE \`audit_logs\``);
  }
}
