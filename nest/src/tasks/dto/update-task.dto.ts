import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { TaskLinkDto } from './task-link.dto';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  content?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50_000)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => TaskLinkDto)
  links?: TaskLinkDto[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  statusCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  priorityCode?: string | null;

  @IsOptional()
  @IsUUID()
  assigneeMemberId?: string | null;

  @IsOptional()
  @IsUUID()
  requesterMemberId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  requestingDeptCode?: string | null;

  @IsOptional()
  @IsDateString()
  deadline?: string | null;

  @IsOptional()
  @IsDateString()
  plannedCompletionDate?: string | null;

  @IsOptional()
  @IsDateString()
  plannedReleaseDate?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  tagCodes?: string[];
}
