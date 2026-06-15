import type { TaskResponse } from '../../tasks/tasks.service';

/**
 * 公開API のタスク表現。内部 UUID（id / projectId）は露出せず、
 * 安定識別子の seq / shortCode と、各マスタの code を返す。
 */
export interface PublicTask {
  seq: number;
  shortCode: string;
  content: string;
  description: string;
  links: { label: string; url: string }[];
  statusCode: string;
  priorityCode: string | null;
  assigneeMemberId: string | null;
  requesterMemberId: string | null;
  requestingDeptCode: string | null;
  tagCodes: string[];
  flagCodes: string[];
  deadline: string | null;
  plannedStartDate: string | null;
  plannedCompletionDate: string | null;
  plannedReleaseDate: string | null;
  completedAt: Date | null;
  statusChangedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const toPublicTask = (t: TaskResponse): PublicTask => ({
  seq: t.seq,
  shortCode: t.shortCode,
  content: t.content,
  description: t.description,
  links: t.links,
  statusCode: t.statusCode,
  priorityCode: t.priorityCode,
  assigneeMemberId: t.assigneeMemberId,
  requesterMemberId: t.requesterMemberId,
  requestingDeptCode: t.requestingDeptCode,
  tagCodes: t.tagCodes,
  flagCodes: t.flagCodes,
  deadline: t.deadline,
  plannedStartDate: t.plannedStartDate,
  plannedCompletionDate: t.plannedCompletionDate,
  plannedReleaseDate: t.plannedReleaseDate,
  completedAt: t.completedAt,
  statusChangedAt: t.statusChangedAt,
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
});
