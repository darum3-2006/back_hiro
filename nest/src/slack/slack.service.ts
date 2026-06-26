import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../projects/project.entity';
import type { Task } from '../tasks/task.entity';
import { Tenant } from '../tenants/tenant.entity';

/**
 * プロジェクトごとに設定された Slack Incoming Webhook へ通知を送る。
 * タスク操作後にベストエフォートで呼び出す（送信失敗してもタスク操作は壊さない）。
 */
@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projects: Repository<Project>,
    @InjectRepository(Tenant)
    private readonly tenants: Repository<Tenant>,
    private readonly config: ConfigService,
  ) {}

  /** 新しいタスクが登録されたとき。 */
  async notifyTaskCreated(tenantId: string, task: Task): Promise<void> {
    await this.dispatch(
      tenantId,
      task,
      'task_created',
      (p) => p.slackNotifyTaskCreated,
      (url) => `:new: 新しいタスク ${this.taskLink(task, url)} が登録されました`,
    );
  }

  /** ステータスが変わったとき（完了を除く）。 */
  async notifyTaskStatusChanged(tenantId: string, task: Task, statusLabel: string): Promise<void> {
    await this.dispatch(
      tenantId,
      task,
      'status_changed',
      (p) => p.slackNotifyStatusChanged,
      (url) =>
        `:arrows_counterclockwise: ${this.taskLink(task, url)} のステータスが「${this.esc(statusLabel)}」に変わりました`,
    );
  }

  /** タスクが完了したとき（終端ステータスへ遷移）。 */
  async notifyTaskCompleted(tenantId: string, task: Task, statusLabel: string): Promise<void> {
    await this.dispatch(
      tenantId,
      task,
      'task_completed',
      (p) => p.slackNotifyTaskCompleted,
      (url) =>
        `:white_check_mark: ${this.taskLink(task, url)} が完了しました（${this.esc(statusLabel)}）`,
    );
  }

  /** 設定画面の「テスト送信」。Webhook 未設定なら 400、送信失敗なら例外を投げる。 */
  async sendTest(tenantId: string, projectId: string): Promise<{ ok: true }> {
    const project = await this.projects.findOne({ where: { id: projectId, tenantId } });
    if (!project) throw new BadRequestException('プロジェクトが見つかりません');
    if (!project.slackWebhookUrl) {
      throw new BadRequestException('Slack Webhook URL が未設定です');
    }
    const ok = await this.post(
      project.slackWebhookUrl,
      `:satellite: ${this.esc(project.name)} のテスト通知です。この投稿が見えていれば連携できています。`,
    );
    if (!ok)
      throw new BadRequestException('Slack への送信に失敗しました。Webhook URL を確認してください');
    return { ok: true };
  }

  // ===== 内部 =====

  /** 設定の確認 → メッセージ生成 → 送信。失敗はログのみ（ベストエフォート）。 */
  private async dispatch(
    tenantId: string,
    task: Task,
    kind: string,
    enabled: (p: Project) => boolean,
    buildText: (url: string | null) => string,
  ): Promise<void> {
    try {
      const project = await this.projects.findOne({ where: { id: task.projectId, tenantId } });
      if (!project || !project.slackWebhookUrl || !enabled(project)) return;
      const url = await this.taskUrl(tenantId, task);
      await this.post(project.slackWebhookUrl, buildText(url));
    } catch (e) {
      this.logger.error(`Slack ${kind} 通知に失敗 (task ${task.id})`, e as Error);
    }
  }

  /** タスク短縮 URL を組み立てる。APP_BASE_URL 未設定なら null（リンクなし）。 */
  private async taskUrl(tenantId: string, task: Task): Promise<string | null> {
    const base = this.config.get<string>('APP_BASE_URL')?.replace(/\/+$/, '');
    if (!base) return null;
    const tenant = await this.tenants.findOne({ where: { id: tenantId }, select: { key: true } });
    if (!tenant) return null;
    return `${base}/${tenant.key}/${task.shortCode}`;
  }

  /** Slack mrkdwn のタスクリンク。URL があれば `<url|#N タイトル>`、無ければテキストのみ。 */
  private taskLink(task: Task, url: string | null): string {
    const label = `#${task.seq} ${this.esc(this.shorten(task.content))}`;
    return url ? `<${url}|${label}>` : `*${label}*`;
  }

  private shorten(s: string): string {
    return s.length > 60 ? `${s.slice(0, 60)}…` : s;
  }

  /** Slack mrkdwn の特殊文字をエスケープ（リンク構文の誤動作防止）。 */
  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Webhook へ POST。成功（res.ok）で true。 */
  private async post(webhookUrl: string, text: string): Promise<boolean> {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Backひろ', text }),
    });
    return res.ok;
  }
}
