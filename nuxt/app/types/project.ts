export interface Project {
  id: string;
  key: string;
  name: string;
  description: string | null;
  archivedAt: string | null;
  highlightOverdueDeadline: boolean;
  highlightOverduePlannedStart: boolean;
  highlightOverduePlannedCompletion: boolean;
  highlightOverduePlannedRelease: boolean;
}
