import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskCompletedAt1779235200000 implements MigrationInterface {
  name = 'AddTaskCompletedAt1779235200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`tasks\` ADD \`completed_at\` datetime(6) NULL COMMENT '完了日時（ステータスが完了扱いの間だけ値を持つ）'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`tasks\` DROP COLUMN \`completed_at\``);
  }
}
