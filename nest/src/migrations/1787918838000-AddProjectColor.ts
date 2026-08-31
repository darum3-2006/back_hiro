import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectColor1787918838000 implements MigrationInterface {
  name = 'AddProjectColor1787918838000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`projects\` ADD \`color\` varchar(16) NULL COMMENT 'テーマ色（マスタ系と同じ色名。ヘッダ等の背景に使う。NULL=未設定）'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`projects\` DROP COLUMN \`color\``);
  }
}
