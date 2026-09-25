import { SetMetadata } from '@nestjs/common';

export const PROJECT_MANAGEMENT_KEY = 'projectManagement';

/**
 * プロジェクトの管理操作に付ける。テナント admin は、そのプロジェクトの ProjectMember でなくても実行できる。
 *
 * 編集は原則メンバーだけ（テナント admin も同じ）だが、プロジェクトの立ち上げ・整備は admin の仕事なので
 * 例外にしている。付けないと admin が自分をメンバーに追加できない（メンバーの追加も書き込みのため）。
 *
 * 対象: プロジェクト設定・Slack 設定・アーカイブ、メンバーの管理、
 * マスタ（ステータス・優先度・タグ・フラグ）の定義の追加・変更・削除・並べ替え。
 * タスクへの作業（タスク・コメント・サブタスク・関連タスク・フラグの一括付け外し）には付けない。
 * 操作ごとの細かい権限（アーカイブは admin のみ等）は各コントローラ・サービス側で判定する。
 */
export const ProjectManagement = () => SetMetadata(PROJECT_MANAGEMENT_KEY, true);
