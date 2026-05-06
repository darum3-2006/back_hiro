import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserRole1778028762161 implements MigrationInterface {
    name = 'AddUserRole1778028762161'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`role\` varchar(16) NOT NULL COMMENT 'テナント内ロール (admin = テナント管理者 / member = 通常)' DEFAULT 'member'`);
        // 既存のシード admin ユーザーを admin ロールに昇格
        await queryRunner.query(`UPDATE \`users\` SET \`role\` = 'admin' WHERE \`email\` = 'admin@acme.test'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`role\``);
    }

}
