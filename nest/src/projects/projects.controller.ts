import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import { SlackService } from '../slack/slack.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Project } from './project.entity';
import { ProjectsService } from './projects.service';

/** フロント返却用のプロジェクト形。Webhook URL の生値は出さず、設定有無のみ返す。 */
type ProjectResponse = Omit<Project, 'slackWebhookUrl' | 'tenant'> & {
  slackWebhookConfigured: boolean;
};

const toResponse = (p: Project): ProjectResponse => {
  // slackWebhookUrl は生値を出さない。tenant はリレーションなのでレスポンスから除く。
  const { slackWebhookUrl, tenant, ...rest } = p;
  void tenant;
  return { ...rest, slackWebhookConfigured: Boolean(slackWebhookUrl) };
};

const touchesSlack = (dto: UpdateProjectDto): boolean =>
  dto.slackWebhookUrl !== undefined ||
  dto.slackNotifyTaskCreated !== undefined ||
  dto.slackNotifyStatusChanged !== undefined ||
  dto.slackNotifyTaskCompleted !== undefined;

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly slack: SlackService,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser): Promise<ProjectResponse[]> {
    const rows = await this.projects.listByTenant(user.tenantId);
    return rows.map(toResponse);
  }

  @Post()
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectResponse> {
    return toResponse(await this.projects.create(user.tenantId, dto));
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectResponse> {
    // アーカイブ/復元 (archived の切替) は admin のみ許可
    if (dto.archived !== undefined && user.role !== 'admin') {
      throw new ForbiddenException('プロジェクトのアーカイブ/復元は管理者のみ実行できます');
    }
    // Slack 設定はプロジェクト管理者 or テナント管理者のみ
    if (touchesSlack(dto)) {
      await this.assertSlackAdmin(user, id);
    }
    return toResponse(await this.projects.update(user.tenantId, id, dto));
  }

  /** 設定画面の「テスト送信」。プロジェクト管理者 or テナント管理者のみ。 */
  @Post(':id/slack/test')
  async testSlack(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.assertSlackAdmin(user, id);
    return this.slack.sendTest(user.tenantId, id);
  }

  private async assertSlackAdmin(user: AuthenticatedUser, projectId: string): Promise<void> {
    if (user.role === 'admin') return;
    if (await this.projects.isProjectAdmin(projectId, user.userId)) return;
    throw new ForbiddenException('Slack 設定はプロジェクト管理者のみ変更できます');
  }
}
