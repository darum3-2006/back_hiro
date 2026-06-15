import { IsString, MaxLength, MinLength } from 'class-validator';

/** フラグのコピー / 移動先（ターゲットフラグ）の指定。 */
export class FlagTargetDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  targetCode!: string;
}
