import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * users.role に readonly（閲覧のみ）を追加したため、列コメントを実態に合わせる。
 * 値は varchar のためスキーマ変更は不要（コメントのみ）。
 */
export class UpdateUserRoleCommentForReadonly1784190611397 implements MigrationInterface {
  name = 'UpdateUserRoleCommentForReadonly1784190611397';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`role\` \`role\` varchar(16) NOT NULL COMMENT 'テナント内ロール (admin = テナント管理者 / power_user / member = 通常 / readonly = 閲覧のみ)' DEFAULT 'member'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`users\` CHANGE \`role\` \`role\` varchar(16) NOT NULL COMMENT 'テナント内ロール (admin = テナント管理者 / member = 通常)' DEFAULT 'member'`,
    );
  }
}
