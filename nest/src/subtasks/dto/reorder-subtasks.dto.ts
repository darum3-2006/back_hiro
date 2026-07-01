import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class ReorderSubtasksDto {
  /** 並び替え後の順序に並んだサブタスク id 配列 */
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  ids!: string[];
}
