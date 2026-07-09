import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSubtaskFlags1780790400000 implements MigrationInterface {
  name = 'AddSubtaskFlags1780790400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`subtask_flags\` (
        \`subtask_id\` varchar(36) NOT NULL COMMENT 'サブタスク',
        \`flag_id\` varchar(36) NOT NULL COMMENT 'フラグ',
        PRIMARY KEY (\`subtask_id\`, \`flag_id\`)
      ) ENGINE=InnoDB COMMENT='サブタスクとフラグの紐付け'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`subtask_flags\` ADD CONSTRAINT \`fk_subtask_flags_subtask\`
        FOREIGN KEY (\`subtask_id\`) REFERENCES \`subtasks\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`subtask_flags\` ADD CONSTRAINT \`fk_subtask_flags_flag\`
        FOREIGN KEY (\`flag_id\`) REFERENCES \`flags\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`subtask_flags\` DROP FOREIGN KEY \`fk_subtask_flags_flag\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`subtask_flags\` DROP FOREIGN KEY \`fk_subtask_flags_subtask\``,
    );
    await queryRunner.query(`DROP TABLE \`subtask_flags\``);
  }
}
