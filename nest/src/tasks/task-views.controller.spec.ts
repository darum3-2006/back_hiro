import { Reflector } from '@nestjs/core';
import { ALLOW_READONLY_KEY } from '../auth/allow-readonly.decorator';
import { TaskViewRecordController } from './task-views.controller';

// 書き込み系は既定で閲覧のみの人を 403 にする。閲覧の記録は本人だけに関わる操作なので
// 許可していることを押さえる（付け忘れると閲覧のみの人の履歴が黙って空になる）。
describe('TaskViewRecordController', () => {
  it('閲覧の記録（POST）は閲覧のみの人にも許可する', () => {
    const allowed = new Reflector().get<boolean>(
      ALLOW_READONLY_KEY,
      TaskViewRecordController.prototype.record,
    );
    expect(allowed).toBe(true);
  });
});
