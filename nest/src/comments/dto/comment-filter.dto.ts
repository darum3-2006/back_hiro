import { IsOptional, IsUUID } from 'class-validator';

/** GET /projects/:projectId/comments/count のクエリ */
export class CommentFilterDto {
  @IsOptional()
  @IsUUID()
  authorMemberId?: string;

  @IsOptional()
  @IsUUID()
  taskId?: string;
}
