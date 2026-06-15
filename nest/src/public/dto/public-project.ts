import type { Project } from '../../projects/project.entity';

/** 公開API のプロジェクト表現。内部 UUID は露出せず key で識別する。 */
export interface PublicProject {
  key: string;
  name: string;
  description: string | null;
}

export const toPublicProject = (p: Project): PublicProject => ({
  key: p.key,
  name: p.name,
  description: p.description,
});
