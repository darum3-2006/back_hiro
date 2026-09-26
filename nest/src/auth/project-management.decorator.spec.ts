import { Reflector } from '@nestjs/core';
import { FlagsController } from '../masters/flags.controller';
import { TagsController } from '../masters/tags.controller';
import { MembersController } from '../members/members.controller';
import { ProjectsController } from '../projects/projects.controller';
import { PROJECT_MANAGEMENT_KEY } from './project-management.decorator';

// 編集はメンバーだけ（テナント admin も同じ）。管理操作だけは admin がメンバーでなくても通る。
// 印の付け忘れ・付け過ぎはガードの挙動をそのまま変えるので、要になる所を押さえておく。
describe('@ProjectManagement() の付け先', () => {
  const reflector = new Reflector();
  const isManagement = (target: object, handler: string): boolean =>
    reflector.get<boolean>(
      PROJECT_MANAGEMENT_KEY,
      (target as Record<string, unknown>)[handler] as () => void,
    ) === true;

  it('メンバーの追加・一括追加・変更・削除（無いと admin が自分をメンバーに追加できない）', () => {
    for (const h of ['create', 'bulkCreate', 'update', 'remove']) {
      expect(isManagement(MembersController.prototype, h)).toBe(true);
    }
  });

  it('プロジェクト設定（アーカイブ・Slack 含む）の変更と Slack のテスト送信', () => {
    expect(isManagement(ProjectsController.prototype, 'update')).toBe(true);
    expect(isManagement(ProjectsController.prototype, 'testSlack')).toBe(true);
  });

  it('マスタの定義の追加・変更・削除', () => {
    for (const h of ['create', 'update', 'remove']) {
      expect(isManagement(TagsController.prototype, h)).toBe(true);
      expect(isManagement(FlagsController.prototype, h)).toBe(true);
    }
  });

  it('フラグのコピー・移動・一括で外す はタスクへの作業なので付けない（メンバーのみ）', () => {
    for (const h of ['copy', 'move', 'detachAll']) {
      expect(isManagement(FlagsController.prototype, h)).toBe(false);
    }
  });
});
