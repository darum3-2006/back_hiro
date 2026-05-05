export interface Comment {
  id: string;
  projectId: string;
  taskId: string;
  authorMemberId: string;
  body: string;
  createdAt: string;
  updatedAt: string | null;
}
