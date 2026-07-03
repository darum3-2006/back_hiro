import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTaskRelations1780617600000 implements MigrationInterface {
  name = 'AddTaskRelations1780617600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE \`task_relations\` (
        \`id\` varchar(36) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) NULL,
        \`project_id\` varchar(36) NOT NULL COMMENT '所属プロジェクト',
        \`source_task_id\` varchar(36) NOT NULL COMMENT '関連元タスク',
        \`target_task_id\` varchar(36) NOT NULL COMMENT '関連先タスク',
        \`type\` varchar(16) NOT NULL COMMENT '関連種別（related=関連 / precedes=先行→後続 / blocks=ブロック）',
        INDEX \`idx_task_relations_source\` (\`source_task_id\`),
        INDEX \`idx_task_relations_target\` (\`target_task_id\`),
        INDEX \`idx_task_relations_project\` (\`project_id\`),
        UNIQUE INDEX \`uq_task_relations\` (\`source_task_id\`, \`target_task_id\`, \`type\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB COMMENT='タスク間の関連（有向 source→target）'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`task_relations\` ADD CONSTRAINT \`fk_task_relations_project\`
        FOREIGN KEY (\`project_id\`) REFERENCES \`projects\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`task_relations\` ADD CONSTRAINT \`fk_task_relations_source\`
        FOREIGN KEY (\`source_task_id\`) REFERENCES \`tasks\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE \`task_relations\` ADD CONSTRAINT \`fk_task_relations_target\`
        FOREIGN KEY (\`target_task_id\`) REFERENCES \`tasks\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`task_relations\` DROP FOREIGN KEY \`fk_task_relations_target\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`task_relations\` DROP FOREIGN KEY \`fk_task_relations_source\``,
    );
    await queryRunner.query(
      `ALTER TABLE \`task_relations\` DROP FOREIGN KEY \`fk_task_relations_project\``,
    );
    await queryRunner.query(`DROP TABLE \`task_relations\``);
  }
}
