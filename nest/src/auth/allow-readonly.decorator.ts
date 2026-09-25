import { SetMetadata } from '@nestjs/common';

export const ALLOW_READONLY_KEY = 'allowReadonly';

/**
 * 閲覧のみの人にも実行を許可する書き込み系エンドポイントに付ける。
 * 「閲覧のみ」は次の 2 通りで、どちらもこの印で通る。
 * - readonly ロールのユーザー（判定: ReadonlyWriteBlockInterceptor）
 * - 閲覧権はあるがそのプロジェクトの ProjectMember でないユーザー（判定: ProjectAccessGuard）
 *
 * プロジェクトのデータを変えない、本人だけに関わる操作に限って付ける。
 * 対象: 自分の通知の既読化・通知設定、パスワード変更、自分の画面設定、保存ビュー（private のみ、
 * 追加制約は各 Service 側で担保する）。
 */
export const AllowReadonly = () => SetMetadata(ALLOW_READONLY_KEY, true);
