import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskPlannedReleaseDate1779408000000 implements MigrationInterface {
  name = 'AddTaskPlannedReleaseDate1779408000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`tasks\` ADD \`planned_release_date\` date NULL COMMENT 'リリース予定日'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`tasks\` DROP COLUMN \`planned_release_date\``);
  }
}
