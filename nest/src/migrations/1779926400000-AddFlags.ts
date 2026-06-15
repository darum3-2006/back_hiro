import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFlags1779926400000 implements MigrationInterface {
  name = 'AddFlags1779926400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`flags\` (
        \`id\` varchar(36) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) NULL,
        \`project_id\` varchar(36) NOT NULL COMMENT '所属プロジェクト',
        \`code\` varchar(64) NOT NULL COMMENT '識別コード（プロジェクト内一意）',
        \`name\` varchar(100) NOT NULL COMMENT 'フラグ名',
        \`color\` varchar(16) NOT NULL COMMENT '表示色',
        UNIQUE INDEX \`uq_flags_project_code\` (\`project_id\`, \`code\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB COMMENT='タスクフラグ（プロジェクト単位）'`,
    );
    await queryRunner.query(
      `CREATE TABLE \`task_flags\` (
        \`task_id\` varchar(36) NOT NULL COMMENT 'タスク',
        \`flag_id\` varchar(36) NOT NULL COMMENT 'フラグ',
        PRIMARY KEY (\`task_id\`, \`flag_id\`)
      ) ENGINE=InnoDB COMMENT='タスクとフラグの紐付け'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`flags\` ADD CONSTRAINT \`fk_flags_project\`
        FOREIGN KEY (\`project_id\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`task_flags\` ADD CONSTRAINT \`fk_task_flags_task\`
        FOREIGN KEY (\`task_id\`) REFERENCES \`tasks\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`task_flags\` ADD CONSTRAINT \`fk_task_flags_flag\`
        FOREIGN KEY (\`flag_id\`) REFERENCES \`flags\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`task_flags\` DROP FOREIGN KEY \`fk_task_flags_flag\``);
    await queryRunner.query(`ALTER TABLE \`task_flags\` DROP FOREIGN KEY \`fk_task_flags_task\``);
    await queryRunner.query(`ALTER TABLE \`flags\` DROP FOREIGN KEY \`fk_flags_project\``);
    await queryRunner.query(`DROP TABLE \`task_flags\``);
    await queryRunner.query(`DROP TABLE \`flags\``);
  }
}
