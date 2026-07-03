import { IsIn, IsUUID } from 'class-validator';

/**
 * 起点タスクから見た関連の種類（API 入力）。
 * - related      : 関連（対称）
 * - successor    : 相手が後続（このタスクの後）
 * - predecessor  : 相手が先行（このタスクの前）
 * - blocks       : このタスクが相手をブロック
 * - blocked_by   : 相手にブロックされる
 */
export const RELATION_KINDS = [
  'related',
  'successor',
  'predecessor',
  'blocks',
  'blocked_by',
] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

export class CreateTaskRelationDto {
  @IsUUID()
  otherTaskId!: string;

  @IsIn(RELATION_KINDS)
  kind!: RelationKind;
}
