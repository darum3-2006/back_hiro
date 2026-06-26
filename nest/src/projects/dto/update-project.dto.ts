import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  /** true = アーカイブ、false = 復元 */
  @IsOptional()
  @IsBoolean()
  archived?: boolean;

  @IsOptional()
  @IsBoolean()
  highlightOverdueDeadline?: boolean;

  @IsOptional()
  @IsBoolean()
  highlightOverduePlannedStart?: boolean;

  @IsOptional()
  @IsBoolean()
  highlightOverduePlannedCompletion?: boolean;

  @IsOptional()
  @IsBoolean()
  highlightOverduePlannedRelease?: boolean;

  /**
   * Slack Incoming Webhook URL。null / '' で解除。非空のときだけ Slack の Webhook 形式を検証する。
   */
  @IsOptional()
  @ValidateIf((o: UpdateProjectDto) => o.slackWebhookUrl !== null && o.slackWebhookUrl !== '')
  @IsString()
  @MaxLength(512)
  @Matches(/^https:\/\/hooks\.slack\.com\/services\//, {
    message:
      'Slack の Incoming Webhook URL（https://hooks.slack.com/services/…）を指定してください',
  })
  slackWebhookUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  slackNotifyTaskCreated?: boolean;

  @IsOptional()
  @IsBoolean()
  slackNotifyStatusChanged?: boolean;

  @IsOptional()
  @IsBoolean()
  slackNotifyTaskCompleted?: boolean;
}
