import { randomBytes } from 'crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const LENGTH = 10;

const genCode = (): string => {
  const bytes = randomBytes(LENGTH);
  let out = '';
  for (let i = 0; i < LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
};

export class AddTaskShortCode1779580800000 implements MigrationInterface {
  name = 'AddTaskShortCode1779580800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) まず NULL 許容で追加し、既存行を埋められるようにする
    await queryRunner.query(
      `ALTER TABLE \`tasks\` ADD \`short_code\` varchar(16) NULL COMMENT '共有リンク用の不透明な短縮コード（/:tenantKey/:shortCode、グローバル一意）'`,
    );

    // 2) 既存タスクにユニークな短縮コードをバックフィル
    const rows = (await queryRunner.query('SELECT `id` FROM `tasks`')) as { id: string }[];
    const used = new Set<string>();
    for (const row of rows) {
      let code = genCode();
      while (used.has(code)) code = genCode();
      used.add(code);
      await queryRunner.query('UPDATE `tasks` SET `short_code` = ? WHERE `id` = ?', [code, row.id]);
    }

    // 3) ユニークインデックスを張り、NOT NULL 化する
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`uq_tasks_short_code\` ON \`tasks\` (\`short_code\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`tasks\` MODIFY \`short_code\` varchar(16) NOT NULL COMMENT '共有リンク用の不透明な短縮コード（/:tenantKey/:shortCode、グローバル一意）'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`uq_tasks_short_code\` ON \`tasks\``);
    await queryRunner.query(`ALTER TABLE \`tasks\` DROP COLUMN \`short_code\``);
  }
}
