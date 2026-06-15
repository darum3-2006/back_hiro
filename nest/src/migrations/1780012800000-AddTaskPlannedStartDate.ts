import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskPlannedStartDate1780012800000 implements MigrationInterface {
  name = 'AddTaskPlannedStartDate1780012800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`tasks\` ADD \`planned_start_date\` date NULL COMMENT '着手予定日'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`projects\` ADD \`highlight_overdue_planned_start\` tinyint NOT NULL DEFAULT 0 COMMENT '着手予定日超過の行を赤く強調する'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`projects\` DROP COLUMN \`highlight_overdue_planned_start\``,
    );
    await queryRunner.query(`ALTER TABLE \`tasks\` DROP COLUMN \`planned_start_date\``);
  }
}
