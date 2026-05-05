import { ArrayUnique, IsArray, IsString } from 'class-validator';

export class ReorderDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  orderedCodes!: string[];
}
