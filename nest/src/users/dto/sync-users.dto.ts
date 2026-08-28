import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { USER_ROLES, type UserRole } from '../user.entity';

/** 1 回の同期で受け付ける最大行数（プレビュー行 / 実行アクション共通） */
export const USER_SYNC_MAX_ROWS = 2000;

/**
 * Excel の 1 行（フロントでパースした生の値）。
 * 形式不正はサーバ側で「エラー」タイプに分類してプレビューに出すため、ここでは緩く受ける。
 */
export class UserSyncRowDto {
  @IsString()
  @MaxLength(500)
  email!: string;

  @IsString()
  @MaxLength(500)
  name!: string;

  /** ロール列の生値。有効値ならデフォルトロールより優先、無効・空欄ならデフォルトを適用 */
  @IsOptional()
  @IsString()
  @MaxLength(50)
  role?: string;
}

export class UserSyncPreviewDto {
  @IsArray()
  @ArrayMaxSize(USER_SYNC_MAX_ROWS)
  @ValidateNested({ each: true })
  @Type(() => UserSyncRowDto)
  rows!: UserSyncRowDto[];

  /** ロール列が空欄・無効な新規追加行に適用するロール */
  @IsIn(USER_ROLES)
  defaultRole!: UserRole;

  /** 新規追加ユーザーに付与するプロジェクト（デフォルト値。行単位でプレビューから変更可） */
  @IsOptional()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  projectIds?: string[];
}

export type UserSyncActionType = 'create' | 'restore' | 'delete';

/**
 * プレビューで確定した行ごとのアクション。
 * create は email / name / role / projectIds、restore / delete は userId を使う。
 * 型ごとの必須チェックはサービス側で行い、不正なアクションは行単位でスキップする。
 */
export class UserSyncActionDto {
  @IsIn(['create', 'restore', 'delete'])
  type!: UserSyncActionType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: UserRole;

  @IsOptional()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  projectIds?: string[];

  @IsOptional()
  @IsUUID('4')
  userId?: string;
}

export class UserSyncExecuteDto {
  @IsArray()
  @ArrayMaxSize(USER_SYNC_MAX_ROWS)
  @ValidateNested({ each: true })
  @Type(() => UserSyncActionDto)
  actions!: UserSyncActionDto[];
}
