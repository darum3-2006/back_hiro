/**
 * スプレッドシート → DB 移行 CLI。
 *
 * 使い方:
 *   pnpm migrate:xlsx <xlsxパス> --tenant-key=<key> --project-key=<key> [--dry-run]
 *
 * 例:
 *   pnpm migrate:xlsx ~/Downloads/システム改修対応一覧.xlsx \
 *     --tenant-key=acme --project-key=KAISYU --dry-run
 *
 * --dry-run: DB に書き込まず、正規化結果のサマリを stdout に出すだけ。
 *
 * 設計方針:
 *   - production コード (src/) には依存するが、コードはこのディレクトリに閉じる
 *   - NestFactory.createApplicationContext で AppModule を起動 → Service 経由で投入
 *   - 直接 Repository を触らず、各 Service を経由してバリデーション/不変条件を保つ
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { DepartmentsService } from '../../src/departments/departments.service';
import { MastersModule } from '../../src/masters/masters.module';
import { TagsService } from '../../src/masters/tags.service';
import type { MasterColor } from '../../src/masters/task-status.entity';
import { TaskPrioritiesService } from '../../src/masters/task-priorities.service';
import { TaskStatusesService } from '../../src/masters/task-statuses.service';
import { MembersService } from '../../src/members/members.service';
import { Project } from '../../src/projects/project.entity';
import { ProjectsService } from '../../src/projects/projects.service';
import { TasksService } from '../../src/tasks/tasks.service';
import { TenantsService } from '../../src/tenants/tenants.service';
import { INITIAL_PRIORITIES, INITIAL_STATUSES, type NormalizedTaskRow } from './mapping';
import { collectNormalizedRows, readWorkbook } from './parser';

interface CliArgs {
  filePath: string;
  tenantKey: string;
  projectKey: string;
  dryRun: boolean;
  clear: boolean;
}

const parseArgs = (argv: string[]): CliArgs => {
  const positional: string[] = [];
  let tenantKey = '';
  let projectKey = '';
  let dryRun = false;
  let clear = false;
  for (const a of argv) {
    if (a.startsWith('--tenant-key=')) tenantKey = a.slice('--tenant-key='.length);
    else if (a.startsWith('--project-key=')) projectKey = a.slice('--project-key='.length);
    else if (a === '--dry-run') dryRun = true;
    else if (a === '--clear') clear = true;
    else positional.push(a);
  }
  if (positional.length === 0 || !tenantKey || !projectKey) {
    throw new Error(
      'Usage: pnpm migrate:xlsx <file.xlsx> --tenant-key=<key> --project-key=<key> [--dry-run] [--clear]',
    );
  }
  return { filePath: positional[0], tenantKey, projectKey, dryRun, clear };
};

/** シート名 → タグの色（任意） */
const SHEET_TAG_COLOR: Record<string, MasterColor> = {
  'システム改修対応一覧': 'error',
  '改修要望対応状況': 'info',
  '■安定期 最優先タスク': 'warning',
};

const summarize = (rows: NormalizedTaskRow[]): void => {
  const bySheet = new Map<string, number>();
  const byStatus = new Map<string, number>();
  const byPriority = new Map<string, number>();
  const assignees = new Set<string>();
  const requesters = new Set<string>();
  const departments = new Set<string>();
  let withDeadline = 0;
  let withPlanned = 0;

  for (const r of rows) {
    bySheet.set(r.sourceSheet, (bySheet.get(r.sourceSheet) ?? 0) + 1);
    byStatus.set(r.statusLabel, (byStatus.get(r.statusLabel) ?? 0) + 1);
    if (r.priorityLabel) byPriority.set(r.priorityLabel, (byPriority.get(r.priorityLabel) ?? 0) + 1);
    if (r.assigneeName) assignees.add(r.assigneeName);
    if (r.requesterName) requesters.add(r.requesterName);
    if (r.requestingDeptName) departments.add(r.requestingDeptName);
    if (r.deadline) withDeadline++;
    if (r.plannedCompletionDate) withPlanned++;
  }

  console.log(`\n[summary] total tasks: ${rows.length}`);
  console.log(`  by sheet: ${[...bySheet].map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`  by status: ${[...byStatus].map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`  by priority: ${[...byPriority].map(([k, v]) => `${k}=${v}`).join(', ')}`);
  console.log(`  with deadline: ${withDeadline} / planned: ${withPlanned}`);
  console.log(`  assignees (${assignees.size}): ${[...assignees].join(', ')}`);
  console.log(`  requesters (${requesters.size}): ${[...requesters].slice(0, 20).join(', ')}${requesters.size > 20 ? '…' : ''}`);
  console.log(`  departments (${departments.size}): ${[...departments].join(', ')}`);
};

const run = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));
  console.log(
    `[migrate] file=${args.filePath} tenant=${args.tenantKey} project=${args.projectKey} dryRun=${args.dryRun}`,
  );

  const wb = readWorkbook(args.filePath);
  console.log(`[migrate] sheets: ${wb.SheetNames.join(', ')}`);
  const allRows = collectNormalizedRows(wb);
  // 完了タスクは移行対象から除外
  const rows = allRows.filter((r) => r.statusLabel !== '完了');
  console.log(`[migrate] excluded ${allRows.length - rows.length} completed rows`);
  summarize(rows);

  if (args.dryRun) {
    console.log('\n[migrate] preview first 3 rows:');
    console.dir(rows.slice(0, 3), { depth: null });
    console.log('\n[migrate] dry-run finished. DB は変更していません。');
    return;
  }

  // 実投入: NestJS app context 経由で Service を借用する
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const tenants = app.get(TenantsService);
    const projects = app.get(ProjectsService);
    const taskStatuses = app.select(MastersModule).get(TaskStatusesService);
    const taskPriorities = app.select(MastersModule).get(TaskPrioritiesService);
    const tagsSvc = app.select(MastersModule).get(TagsService);
    const departmentsSvc = app.get(DepartmentsService);
    const members = app.get(MembersService);
    const tasksSvc = app.get(TasksService);
    const projectsRepo = app.get<Repository<Project>>(getRepositoryToken(Project));

    const tenant = await tenants.findByKey(args.tenantKey);
    if (!tenant) throw new Error(`tenant not found: ${args.tenantKey}`);

    let project = (await projects.listByTenant(tenant.id)).find((p) => p.key === args.projectKey);

    // --clear: 既存プロジェクトを削除して作り直す（CASCADE で task/member/master/comment も消える）
    if (project && args.clear) {
      await projectsRepo.remove(project);
      console.log(`[migrate] cleared existing project: ${args.projectKey}`);
      project = undefined;
    }

    if (!project) {
      project = await projects.create(tenant.id, {
        key: args.projectKey,
        name: args.projectKey,
        description: 'スプレッドシートから移行',
      });
      console.log(`[migrate] created project: ${project.id}`);
    } else {
      console.log(`[migrate] reusing project: ${project.id}`);
    }

    // マスタ初期化（既存があればスキップ）
    let statuses = await taskStatuses.listByProject(tenant.id, project.id);
    if (statuses.length === 0) {
      for (const s of INITIAL_STATUSES) {
        await taskStatuses.create(tenant.id, project.id, s);
      }
      statuses = await taskStatuses.listByProject(tenant.id, project.id);
      console.log(`[migrate] created ${INITIAL_STATUSES.length} statuses`);
    }
    let priorities = await taskPriorities.listByProject(tenant.id, project.id);
    if (priorities.length === 0) {
      for (const p of INITIAL_PRIORITIES) {
        await taskPriorities.create(tenant.id, project.id, p);
      }
      priorities = await taskPriorities.listByProject(tenant.id, project.id);
      console.log(`[migrate] created ${INITIAL_PRIORITIES.length} priorities`);
    }
    const statusByLabel = new Map(statuses.map((s) => [s.label, s.code]));
    const priorityByLabel = new Map(priorities.map((p) => [p.label, p.code]));

    // 部署マスタ: 必要なものだけ作成（依頼部署が出てくる行のみ）
    const neededDeptNames = new Set<string>();
    for (const r of rows) if (r.requestingDeptName) neededDeptNames.add(r.requestingDeptName);
    const existingDepts = await departmentsSvc.listByTenant(tenant.id);
    const deptByName = new Map(existingDepts.map((d) => [d.name, d.code]));
    for (const name of neededDeptNames) {
      if (!deptByName.has(name)) {
        const code = `dept_${[...deptByName.keys()].length + 1}`;
        const dept = await departmentsSvc.create(tenant.id, { code, name });
        deptByName.set(dept.name, dept.code);
        console.log(`[migrate] created department: ${dept.name}`);
      }
    }

    // メンバー: assignee と requester を displayName ユニーク化して作成
    const neededMemberNames = new Set<string>();
    for (const r of rows) {
      if (r.assigneeName) neededMemberNames.add(r.assigneeName);
      if (r.requesterName) neededMemberNames.add(r.requesterName);
    }
    const existingMembers = await members.listByProject(tenant.id, project.id);
    const memberByName = new Map(existingMembers.map((m) => [m.displayName, m.id]));
    for (const name of neededMemberNames) {
      if (!memberByName.has(name)) {
        const m = await members.create(tenant.id, project.id, {
          displayName: name,
          role: 'member',
        });
        memberByName.set(m.displayName, m.id);
      }
    }
    console.log(`[migrate] members ready: ${memberByName.size}`);

    // シート名タグ: 各シート名に対応するタグを作成（既存があれば再利用）
    const neededSheets = new Set<string>();
    for (const r of rows) neededSheets.add(r.sourceSheet);
    const existingTags = await tagsSvc.listByProject(tenant.id, project.id);
    const tagByName = new Map(existingTags.map((t) => [t.name, t.code]));
    for (const sheet of neededSheets) {
      if (!tagByName.has(sheet)) {
        const color = SHEET_TAG_COLOR[sheet] ?? 'neutral';
        const tag = await tagsSvc.create(tenant.id, project.id, { name: sheet, color });
        tagByName.set(tag.name, tag.code);
        console.log(`[migrate] created sheet tag: ${tag.name}`);
      }
    }

    // タスク投入
    let inserted = 0;
    let failed = 0;
    for (const r of rows) {
      const statusCode = statusByLabel.get(r.statusLabel);
      if (!statusCode) {
        failed++;
        continue;
      }
      const sheetTagCode = tagByName.get(r.sourceSheet);
      try {
        await tasksSvc.create(tenant.id, project.id, {
          content: r.content,
          description: r.description,
          links: r.links,
          statusCode,
          priorityCode: r.priorityLabel ? (priorityByLabel.get(r.priorityLabel) ?? null) : null,
          assigneeMemberId: r.assigneeName ? (memberByName.get(r.assigneeName) ?? null) : null,
          requesterMemberId: r.requesterName ? (memberByName.get(r.requesterName) ?? null) : null,
          requestingDeptCode: r.requestingDeptName
            ? (deptByName.get(r.requestingDeptName) ?? null)
            : null,
          deadline: r.deadline,
          plannedCompletionDate: r.plannedCompletionDate,
          tagCodes: sheetTagCode ? [sheetTagCode] : [],
        });
        inserted++;
      } catch (e) {
        failed++;
        console.error(`[migrate] failed for "${r.content.slice(0, 40)}...":`, e);
      }
    }
    console.log(`[migrate] tasks: inserted=${inserted}, failed=${failed}, total=${rows.length}`);
  } finally {
    await app.close();
  }
};

run().catch((err: unknown) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
