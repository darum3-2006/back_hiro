/** 起点タスクから見た関連の種類 */
export type RelationKind = 'related' | 'successor' | 'predecessor' | 'blocks' | 'blocked_by';

/** 保存形の関連種別（有向 source→target） */
export type TaskRelationType = 'related' | 'precedes' | 'blocks';

/** タスク詳細用: 起点タスクから見た 1 件の関連 */
export interface TaskRelationView {
  id: string;
  kind: RelationKind;
  otherTaskId: string;
  otherSeq: number;
  otherContent: string;
  otherStatusCode: string;
}

/** ガント用: プロジェクト内の有向エッジ */
export interface TaskRelationEdge {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  type: TaskRelationType;
}
