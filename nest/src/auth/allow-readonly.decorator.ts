import { SetMetadata } from '@nestjs/common';

export const ALLOW_READONLY_KEY = 'allowReadonly';

/**
 * readonly（閲覧のみ）ユーザーにも実行を許可する書き込み系エンドポイントに付ける。
 * 対象: 自分の通知の既読化・通知設定、パスワード変更、保存ビュー（private のみ、
 * 追加制約は各 Service 側で担保する）。
 * 判定は ReadonlyWriteBlockInterceptor が行う。
 */
export const AllowReadonly = () => SetMetadata(ALLOW_READONLY_KEY, true);
