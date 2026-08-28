import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * users に有効フラグ（is_active）を追加する。
 * false のユーザーはログイン・トークンリフレッシュ・公開APIキー利用を拒否される。
 * 既存ユーザーは全員有効（DEFAULT 1）として扱う。
 */
export class AddUserIsActive1787788800000 implements MigrationInterface {
  name = 'AddUserIsActive1787788800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` ADD \`is_active\` tinyint NOT NULL COMMENT '有効フラグ（true=ログイン可能、false=ログイン不可）' DEFAULT 1`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`is_active\``);
  }
}
