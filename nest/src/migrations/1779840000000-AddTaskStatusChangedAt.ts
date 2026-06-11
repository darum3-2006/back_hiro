import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskStatusChangedAt1779840000000 implements MigrationInterface {
  name = 'AddTaskStatusChangedAt1779840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const comment = '最新ステータス変更日時（新規作成時は作成時刻、以後ステータス変更のたび更新）';
    // 既存行があるため、まず NULL 許可で追加 → updated_at で埋める → NOT NULL 化の順で行う
    await queryRunner.query(
      `ALTER TABLE \`tasks\` ADD \`status_changed_at\` datetime(6) NULL COMMENT '${comment}'`,
    );
    await queryRunner.query(`UPDATE \`tasks\` SET \`status_changed_at\` = \`updated_at\``);
    await queryRunner.query(
      `ALTER TABLE \`tasks\` MODIFY \`status_changed_at\` datetime(6) NOT NULL COMMENT '${comment}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`tasks\` DROP COLUMN \`status_changed_at\``);
  }
}
