import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * users に画面設定（settings）を追加する。
 * 端末をまたいで引き継ぎたい表示設定（ダッシュボードの基準日付・期限間近の日数など）の置き場。
 *
 * 画面ごとに名前空間を切った JSON なので、設定が増えても列は増えない。
 * 既存ユーザーは NULL＝未設定で、読み出し側が既定値を当てる。
 */
export class AddUserSettings1789200000000 implements MigrationInterface {
  name = 'AddUserSettings1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`settings\` json NULL COMMENT '画面ごとのユーザー設定（ダッシュボード等）。端末をまたいで引き継ぐ'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`settings\``);
  }
}
