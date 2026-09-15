import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * task_statuses に初期フラグ（is_initial）を追加する。
 * 「一度も着手していない」タスクを停滞集計から外すために使う。
 *
 * 既存データは、これまで初期ステータスを表す情報が無かったため
 * プロジェクトごとに display_order が最小のものを初期とみなして立てる
 * （「未着手」等を先頭に置く運用を前提とした推定なので、移行後に設定画面で見直せる）。
 *
 * is_initial と is_terminal の同時 true は不可。CHECK 制約で DB 側でも塞ぐ。
 */
export class AddTaskStatusIsInitial1789000000000 implements MigrationInterface {
  name = 'AddTaskStatusIsInitial1789000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`task_statuses\` ADD \`is_initial\` tinyint NOT NULL COMMENT '初期状態（true=未着手扱い）。is_terminal との同時 true は不可' DEFAULT 0`,
    );

    // プロジェクトごとに display_order 最小の 1 件を初期ステータスとみなす。
    // 同順位が複数ある場合は code の小さい方に寄せて 1 件に定める。
    // 終了扱いのステータスは排他条件により対象外。
    await queryRunner.query(`
      UPDATE \`task_statuses\` s
      JOIN (
        SELECT project_id, MIN(display_order) AS min_order
        FROM \`task_statuses\`
        WHERE is_terminal = 0
        GROUP BY project_id
      ) m ON m.project_id = s.project_id AND m.min_order = s.display_order
      JOIN (
        SELECT t.project_id, MIN(t.code) AS code
        FROM \`task_statuses\` t
        JOIN (
          SELECT project_id, MIN(display_order) AS min_order
          FROM \`task_statuses\`
          WHERE is_terminal = 0
          GROUP BY project_id
        ) mm ON mm.project_id = t.project_id AND mm.min_order = t.display_order
        WHERE t.is_terminal = 0
        GROUP BY t.project_id
      ) pick ON pick.project_id = s.project_id AND pick.code = s.code
      SET s.is_initial = 1
      WHERE s.is_terminal = 0
    `);

    await queryRunner.query(
      `ALTER TABLE \`task_statuses\` ADD CONSTRAINT \`chk_task_statuses_initial_terminal\` CHECK (NOT (\`is_initial\` = 1 AND \`is_terminal\` = 1))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`task_statuses\` DROP CONSTRAINT \`chk_task_statuses_initial_terminal\``,
    );
    await queryRunner.query(`ALTER TABLE \`task_statuses\` DROP COLUMN \`is_initial\``);
  }
}
