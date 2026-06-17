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

export class AddSavedViewShortCode1780272000000 implements MigrationInterface {
  name = 'AddSavedViewShortCode1780272000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) まず NULL 許容で追加し、既存行を埋められるようにする
    await queryRunner.query(
      `ALTER TABLE \`saved_views\` ADD \`short_code\` varchar(16) NULL COMMENT '共有リンク用の不透明な短縮コード（/:tenantKey/v/:shortCode、グローバル一意）'`,
    );

    // 2) 既存ビューにユニークな短縮コードをバックフィル
    const rows = (await queryRunner.query('SELECT `id` FROM `saved_views`')) as { id: string }[];
    const used = new Set<string>();
    for (const row of rows) {
      let code = genCode();
      while (used.has(code)) code = genCode();
      used.add(code);
      await queryRunner.query('UPDATE `saved_views` SET `short_code` = ? WHERE `id` = ?', [
        code,
        row.id,
      ]);
    }

    // 3) ユニークインデックスを張り、NOT NULL 化する
    await queryRunner.query(
      `CREATE UNIQUE INDEX \`uq_saved_views_short_code\` ON \`saved_views\` (\`short_code\`)`,
    );
    await queryRunner.query(
      `ALTER TABLE \`saved_views\` MODIFY \`short_code\` varchar(16) NOT NULL COMMENT '共有リンク用の不透明な短縮コード（/:tenantKey/v/:shortCode、グローバル一意）'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`uq_saved_views_short_code\` ON \`saved_views\``);
    await queryRunner.query(`ALTER TABLE \`saved_views\` DROP COLUMN \`short_code\``);
  }
}
