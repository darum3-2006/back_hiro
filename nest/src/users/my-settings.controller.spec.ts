import { Reflector } from '@nestjs/core';
import { ALLOW_READONLY_KEY } from '../auth/allow-readonly.decorator';
import { MySettingsController } from './my-settings.controller';

// 書き込み系は ReadonlyWriteBlockInterceptor が既定で readonly を 403 にする。
// 自分の画面設定はプロジェクトのデータを変えないので、readonly にも許可していることを押さえる
// （付け忘れると readonly のユーザーだけ設定を保存できなくなる）。
describe('MySettingsController', () => {
  const reflector = new Reflector();
  const allowsReadonly = (handler: keyof MySettingsController) =>
    reflector.get<boolean>(ALLOW_READONLY_KEY, MySettingsController.prototype[handler]);

  it('設定の保存（PATCH）は readonly にも許可する', () => {
    expect(allowsReadonly('update')).toBe(true);
  });
});
