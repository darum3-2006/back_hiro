import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddComments1777972387469 implements MigrationInterface {
  name = 'AddComments1777972387469';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`comments\` (\`created_at\` datetime(6) NOT NULL COMMENT '作成日時' DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` datetime(6) NOT NULL COMMENT '更新日時' DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` datetime(6) NULL COMMENT '論理削除日時（NULL=有効）', \`id\` varchar(36) NOT NULL, \`project_id\` varchar(36) NOT NULL COMMENT '所属プロジェクト', \`task_id\` varchar(36) NOT NULL COMMENT '対象タスク', \`author_member_id\` varchar(36) NULL COMMENT '投稿者メンバー（NULL = 削除済みメンバー）', \`body\` text NOT NULL COMMENT 'コメント本文（Markdown）', INDEX \`idx_comments_project_author\` (\`project_id\`, \`author_member_id\`), INDEX \`idx_comments_task_created\` (\`task_id\`, \`created_at\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB COMMENT="タスクコメント"`,
    );
    await queryRunner.query(
      `ALTER TABLE \`comments\` ADD CONSTRAINT \`FK_03dbde2ff570596e874bb3bb311\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`comments\` ADD CONSTRAINT \`FK_18c2493067c11f44efb35ca0e03\` FOREIGN KEY (\`task_id\`) REFERENCES \`tasks\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`comments\` ADD CONSTRAINT \`FK_6a2277f82bb16e2e1f50571893d\` FOREIGN KEY (\`author_member_id\`) REFERENCES \`project_members\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`comments\` DROP FOREIGN KEY \`FK_6a2277f82bb16e2e1f50571893d\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`comments\` DROP FOREIGN KEY \`FK_18c2493067c11f44efb35ca0e03\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`comments\` DROP FOREIGN KEY \`FK_03dbde2ff570596e874bb3bb311\``,
    );
    await queryRunner.query(`DROP INDEX \`idx_comments_task_created\` ON \`comments\``);
    await queryRunner.query(`DROP INDEX \`idx_comments_project_author\` ON \`comments\``);
    await queryRunner.query(`DROP TABLE \`comments\``);
  }
}
