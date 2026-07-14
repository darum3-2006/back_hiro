import type { Project } from '../../projects/project.entity';

/** 公開API のプロジェクト表現。内部 UUID は露出せず key で識別する。 */
export interface PublicProject {
  key: string;
  name: string;
  description: string | null;
  /** アーカイブ済みか（一覧は非アーカイブのみ返すが、archive/unarchive の応答で状態を示す） */
  archived: boolean;
}

export const toPublicProject = (p: Project): PublicProject => ({
  key: p.key,
  name: p.name,
  description: p.description,
  archived: p.archivedAt !== null,
});
