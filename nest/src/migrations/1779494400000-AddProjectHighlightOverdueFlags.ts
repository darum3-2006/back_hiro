import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectHighlightOverdueFlags1779494400000 implements MigrationInterface {
  name = 'AddProjectHighlightOverdueFlags1779494400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`projects\` ADD \`highlight_overdue_deadline\` tinyint NOT NULL DEFAULT 0 COMMENT '期限超過の行を赤く強調する'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`projects\` ADD \`highlight_overdue_planned_completion\` tinyint NOT NULL DEFAULT 0 COMMENT '完了予定日超過の行を赤く強調する'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`projects\` ADD \`highlight_overdue_planned_release\` tinyint NOT NULL DEFAULT 0 COMMENT 'リリース予定日超過の行を赤く強調する'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`projects\` DROP COLUMN \`highlight_overdue_planned_release\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`projects\` DROP COLUMN \`highlight_overdue_planned_completion\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`projects\` DROP COLUMN \`highlight_overdue_deadline\``,
    );
  }
}
