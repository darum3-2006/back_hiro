<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui';
import { read, utils, writeFileXLSX } from 'xlsx';
import {
  apiExecuteUserSync,
  apiPreviewUserSync,
  type UserSyncActionInput,
  type UserSyncExecuteResult,
  type UserSyncItemType,
  type UserSyncPreviewItem,
  type UserSyncRowInput,
} from '~/api/users';
import type { UserRole } from '~/types/master';

const { me } = useAuth();
const api = useApi();
const toast = useToast();

// admin 以外がアクセスしたらテナントトップへ送り返す
if (me.value && me.value.role !== 'admin') {
  await navigateTo(`/${me.value.tenant.key}`, { replace: true });
}

const tenantKey = computed(() => me.value?.tenant.key ?? '');

/** 1 回の同期で送れる最大行数（nest 側 USER_SYNC_MAX_ROWS と揃える） */
const MAX_ROWS = 2000;

const step = ref<'upload' | 'preview' | 'result'>('upload');

const showApiError = (e: unknown, fallback: string) => {
  const data =
    typeof e === 'object' && e !== null && 'data' in e
      ? ((e as { data?: { message?: string | string[] } }).data ?? {})
      : {};
  const msg = Array.isArray(data.message) ? data.message.join(', ') : (data.message ?? fallback);
  toast.add({ title: msg, color: 'error' });
};

// ===== Step 1: 取り込み =====
const { data: projects } = await useProjects();
const projectItems = computed(() =>
  projects.value.filter((p) => !p.archivedAt).map((p) => ({ value: p.id, label: p.name })),
);
const projectNameById = computed(() => new Map(projectItems.value.map((i) => [i.value, i.label])));

const defaultRole = ref<UserRole>('member');
const defaultProjectIds = ref<string[]>([]);
const file = ref<File | null>(null);
const loading = ref(false);

const roleItems = USER_ROLES.map((value) => ({
  value,
  label: `${USER_ROLE_LABEL[value]} (${value})`,
}));

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement;
  file.value = input.files?.[0] ?? null;
};

const toCell = (v: unknown): string => (v == null ? '' : String(v).trim());

/**
 * xlsx の 1 シート目を行データに読む。1 行目はヘッダとして捨てる。
 * プレビューの行番号（index + 2）が Excel の行番号と一致するよう、途中の空行は残し、
 * 末尾の完全な空行だけ捨てる（書式だけ残った行でエラーを量産しないため）。
 */
const parseRows = async (f: File): Promise<UserSyncRowInput[]> => {
  const wb = read(await f.arrayBuffer());
  const sheetName = wb.SheetNames[0];
  const sheet = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!sheet) return [];
  const matrix = utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    blankrows: true,
  });
  const rows = matrix.slice(1).map((r) => {
    const role = toCell(r[2]);
    return {
      email: toCell(r[0]),
      name: toCell(r[1]),
      ...(role ? { role } : {}),
    };
  });
  while (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last && !last.email && !last.name && !last.role) rows.pop();
    else break;
  }
  return rows;
};

/** テンプレート xlsx をその場で生成してダウンロードする */
const downloadTemplate = () => {
  const ws = utils.aoa_to_sheet([
    ['メールアドレス', '氏名', 'ロール'],
    ['user@example.com', '山田 太郎', 'member'],
  ]);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'users');
  writeFileXLSX(wb, 'ユーザー同期テンプレート.xlsx');
};

// ===== Step 2: プレビュー =====

/** プレビュー行 + 画面上で編集できる状態（適用チェック / 新規行のロール・プロジェクト） */
interface PreviewRow extends UserSyncPreviewItem {
  apply: boolean;
  editRole: UserRole;
  editProjectIds: string[];
}

const previewItems = ref<PreviewRow[]>([]);
const typeFilter = ref<'all' | UserSyncItemType>('all');

const TYPE_LABEL: Record<UserSyncItemType, string> = {
  create: '新規追加',
  restore: '復活',
  delete: '削除',
  unchanged: '変更なし',
  error: 'エラー',
};
const TYPE_COLOR: Record<UserSyncItemType, 'success' | 'info' | 'error' | 'neutral' | 'warning'> = {
  create: 'success',
  restore: 'info',
  delete: 'error',
  unchanged: 'neutral',
  error: 'warning',
};
const TYPE_ORDER: UserSyncItemType[] = ['create', 'restore', 'delete', 'unchanged', 'error'];

/** 実行対象にできる行か（保護された削除は不可） */
const isActionable = (item: PreviewRow): boolean =>
  (item.type === 'create' || item.type === 'restore' || item.type === 'delete') &&
  !item.protectedReason;

const startPreview = async () => {
  if (!file.value) return;
  loading.value = true;
  try {
    const rows = await parseRows(file.value);
    if (rows.length === 0) {
      toast.add({ title: 'ファイルにデータ行がありません', color: 'error' });
      return;
    }
    if (rows.length > MAX_ROWS) {
      toast.add({ title: `一度に取り込めるのは ${MAX_ROWS} 行までです`, color: 'error' });
      return;
    }
    const res = await apiPreviewUserSync(api, {
      rows,
      defaultRole: defaultRole.value,
      projectIds: defaultProjectIds.value,
    });
    previewItems.value = res.items.map((it) => ({
      ...it,
      apply:
        (it.type === 'create' || it.type === 'restore' || it.type === 'delete') &&
        !it.protectedReason,
      editRole: it.role ?? defaultRole.value,
      editProjectIds: [...(it.projectIds ?? [])],
    }));
    typeFilter.value = 'all';
    step.value = 'preview';
  } catch (e: unknown) {
    showApiError(e, 'プレビューの取得に失敗しました');
  } finally {
    loading.value = false;
  }
};

const countsByType = computed(() => {
  const counts = new Map<UserSyncItemType, number>();
  for (const it of previewItems.value) counts.set(it.type, (counts.get(it.type) ?? 0) + 1);
  return counts;
});

const filteredItems = computed(() =>
  typeFilter.value === 'all'
    ? previewItems.value
    : previewItems.value.filter((it) => it.type === typeFilter.value),
);

const applyCount = computed(
  () => previewItems.value.filter((it) => isActionable(it) && it.apply).length,
);
const applyDeleteCount = computed(
  () =>
    previewItems.value.filter((it) => it.type === 'delete' && isActionable(it) && it.apply).length,
);

const projectNamesOf = (ids: string[]): string[] =>
  ids.map((id) => projectNameById.value.get(id) ?? '(不明)');

const columns: TableColumn<PreviewRow>[] = [
  { id: 'apply', header: '適用' },
  { id: 'type', header: '種別' },
  { accessorKey: 'row', header: '行' },
  { accessorKey: 'email', header: 'メールアドレス' },
  { accessorKey: 'name', header: '氏名' },
  { id: 'role', header: 'ロール' },
  { id: 'projects', header: 'プロジェクト' },
  { id: 'warnings', header: '警告' },
];

// ===== 実行 =====
const confirmOpen = ref(false);
const result = ref<UserSyncExecuteResult | null>(null);

const buildActions = (): UserSyncActionInput[] =>
  previewItems.value
    .filter((it) => isActionable(it) && it.apply)
    .map((it) =>
      it.type === 'create'
        ? {
            type: 'create' as const,
            email: it.email,
            name: it.name,
            role: it.editRole,
            projectIds: it.editProjectIds,
          }
        : { type: it.type as 'restore' | 'delete', userId: it.userId, email: it.email },
    );

const execute = async () => {
  loading.value = true;
  try {
    result.value = await apiExecuteUserSync(api, buildActions());
    confirmOpen.value = false;
    step.value = 'result';
  } catch (e: unknown) {
    showApiError(e, '同期の実行に失敗しました');
  } finally {
    loading.value = false;
  }
};

// ===== Step 3: 結果 =====
const skippedItems = computed(
  () => result.value?.items.filter((it) => it.status === 'skipped') ?? [],
);

const resetToUpload = () => {
  file.value = null;
  previewItems.value = [];
  result.value = null;
  step.value = 'upload';
};
</script>

<template>
  <UDashboardPanel id="user-sync">
    <template #header>
      <UDashboardNavbar title="ユーザー Excel 同期" icon="i-lucide-file-spreadsheet">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-arrow-left"
            label="ユーザー管理へ戻る"
            :to="`/${tenantKey}/settings/users`"
          />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- ===== Step 1: 取り込み ===== -->
      <div v-if="step === 'upload'" class="max-w-xl space-y-6">
        <UAlert
          icon="i-lucide-info"
          color="neutral"
          variant="subtle"
          title="ファイルに載っていないユーザーは削除（論理削除）されます"
          description="1 行目をヘッダとして「メールアドレス / 氏名 / ロール」の 3 列を読み込みます。実行前にプレビューで内容を確認できます。"
        />

        <UFormField label="Excel ファイル (.xlsx)" required>
          <div class="space-y-1">
            <input
              type="file"
              accept=".xlsx"
              class="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-elevated file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accented"
              @change="onFileChange"
            />
            <UButton
              size="xs"
              color="neutral"
              variant="link"
              icon="i-lucide-download"
              label="テンプレートをダウンロード"
              @click="downloadTemplate"
            />
          </div>
        </UFormField>

        <UFormField
          label="デフォルトロール"
          hint="ロール列が空欄・無効な新規追加ユーザーに適用します"
        >
          <SelectMenu
            :items="roleItems"
            :current="defaultRole"
            default-icon="i-lucide-shield"
            @select="(c: string | null) => c && (defaultRole = c as UserRole)"
          >
            <UButton
              color="neutral"
              variant="outline"
              block
              class="justify-between"
              trailing-icon="i-lucide-chevrons-up-down"
            >
              {{ USER_ROLE_LABEL[defaultRole] }} ({{ defaultRole }})
            </UButton>
          </SelectMenu>
        </UFormField>

        <UFormField
          label="閲覧できるプロジェクト"
          hint="新規追加ユーザーに付与します（プレビューで行ごとに変更できます）"
        >
          <USelectMenu
            v-model="defaultProjectIds"
            :items="projectItems"
            value-key="value"
            multiple
            class="w-full"
          >
            <template #default>
              <span v-if="defaultProjectIds.length === 0" class="truncate text-dimmed">
                プロジェクトを選択
              </span>
              <span v-else class="truncate" :title="namesTitle(projectNamesOf(defaultProjectIds))">
                {{ summarizeNames(projectNamesOf(defaultProjectIds)) }}
              </span>
            </template>
          </USelectMenu>
        </UFormField>

        <UButton
          color="primary"
          icon="i-lucide-scan-search"
          label="取り込んでプレビュー"
          :loading="loading"
          :disabled="!file"
          @click="startPreview"
        />
      </div>

      <!-- ===== Step 2: プレビュー ===== -->
      <div v-else-if="step === 'preview'" class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            size="sm"
            :variant="typeFilter === 'all' ? 'solid' : 'outline'"
            color="neutral"
            :label="`全件 (${previewItems.length})`"
            @click="typeFilter = 'all'"
          />
          <UButton
            v-for="t in TYPE_ORDER"
            :key="t"
            size="sm"
            :variant="typeFilter === t ? 'solid' : 'outline'"
            :color="TYPE_COLOR[t]"
            :label="`${TYPE_LABEL[t]} (${countsByType.get(t) ?? 0})`"
            @click="typeFilter = t"
          />
        </div>

        <UTable :data="filteredItems" :columns="columns" :ui="{ td: 'py-2 align-top' }">
          <template #apply-cell="{ row }">
            <template v-if="isActionable(row.original)">
              <UCheckbox v-model="row.original.apply" />
              <!-- 適用チェックの入った削除行だけ行全体を赤くするためのマーカー（CSS の :has で拾う） -->
              <span
                v-if="row.original.type === 'delete' && row.original.apply"
                data-row-delete
                class="hidden"
              />
            </template>
            <span v-else class="text-xs text-muted">-</span>
          </template>
          <template #type-cell="{ row }">
            <!-- 保護された行は削除されないため「削除」バッジは出さず「保護」で表示する -->
            <div v-if="row.original.protectedReason" class="space-y-1">
              <UBadge color="warning" variant="subtle" icon="i-lucide-shield-check" label="保護" />
              <div class="text-xs text-warning">
                {{ row.original.protectedReason }}
              </div>
            </div>
            <UBadge
              v-else
              :color="TYPE_COLOR[row.original.type]"
              variant="subtle"
              :label="TYPE_LABEL[row.original.type]"
            />
          </template>
          <template #row-cell="{ row }">
            <span class="text-xs text-muted">{{ row.original.row ?? '-' }}</span>
          </template>
          <template #email-cell="{ row }">
            <code class="text-xs font-mono text-muted">{{ row.original.email }}</code>
          </template>
          <template #name-cell="{ row }">
            <span class="text-sm">{{ row.original.name }}</span>
          </template>
          <template #role-cell="{ row }">
            <!-- 新規追加は行単位でロールを変更できる。それ以外は現在のロール表示のみ -->
            <SelectMenu
              v-if="row.original.type === 'create'"
              :items="roleItems"
              :current="row.original.editRole"
              default-icon="i-lucide-shield"
              @select="(c: string | null) => c && (row.original.editRole = c as UserRole)"
            >
              <UButton
                color="neutral"
                variant="outline"
                size="xs"
                trailing-icon="i-lucide-chevrons-up-down"
              >
                {{ USER_ROLE_LABEL[row.original.editRole] }}
              </UButton>
            </SelectMenu>
            <UBadge
              v-else-if="row.original.role"
              :color="USER_ROLE_COLOR[row.original.role]"
              variant="subtle"
              :label="USER_ROLE_LABEL[row.original.role]"
            />
            <span v-else class="text-xs text-muted">-</span>
          </template>
          <template #projects-cell="{ row }">
            <!-- 新規追加は行単位で付与プロジェクトを変更できる -->
            <template v-if="row.original.type === 'create'">
              <span v-if="row.original.editRole === 'admin'" class="text-sm text-muted">
                すべて
              </span>
              <USelectMenu
                v-else
                v-model="row.original.editProjectIds"
                :items="projectItems"
                value-key="value"
                multiple
                size="xs"
                class="w-44"
              >
                <template #default>
                  <span
                    v-if="row.original.editProjectIds.length === 0"
                    class="truncate text-dimmed"
                  >
                    なし
                  </span>
                  <span
                    v-else
                    class="truncate"
                    :title="namesTitle(projectNamesOf(row.original.editProjectIds))"
                  >
                    {{ summarizeNames(projectNamesOf(row.original.editProjectIds)) }}
                  </span>
                </template>
              </USelectMenu>
            </template>
            <span v-else class="text-xs text-muted">-</span>
          </template>
          <template #warnings-cell="{ row }">
            <ul v-if="row.original.warnings.length > 0" class="space-y-0.5">
              <li
                v-for="(w, i) in row.original.warnings"
                :key="i"
                class="text-xs text-warning max-w-sm whitespace-normal"
              >
                {{ w }}
              </li>
            </ul>
          </template>
        </UTable>

        <div class="flex items-center gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-chevron-left"
            label="ファイル選択に戻る"
            @click="resetToUpload"
          />
          <span class="ml-auto text-sm text-muted">
            適用 {{ applyCount }} 件（うち削除 {{ applyDeleteCount }} 件）
          </span>
          <UButton
            color="primary"
            icon="i-lucide-play"
            label="同期を実行"
            :disabled="applyCount === 0"
            @click="confirmOpen = true"
          />
        </div>

        <AppModal
          v-model:open="confirmOpen"
          title="ユーザー同期を実行"
          :description="`${applyCount} 件の変更（うち削除 ${applyDeleteCount} 件）を実行しますか?`"
        >
          <template #footer>
            <div class="flex justify-end gap-2 w-full">
              <UButton
                color="neutral"
                variant="ghost"
                label="キャンセル"
                @click="confirmOpen = false"
              />
              <UButton
                color="primary"
                :loading="loading"
                icon="i-lucide-play"
                label="実行"
                @click="execute"
              />
            </div>
          </template>
        </AppModal>
      </div>

      <!-- ===== Step 3: 結果 ===== -->
      <div v-else-if="step === 'result' && result" class="max-w-2xl space-y-6">
        <UAlert
          icon="i-lucide-check-circle"
          color="success"
          variant="subtle"
          title="同期が完了しました"
          :description="`新規追加 ${result.applied.create} 件 / 復活 ${result.applied.restore} 件 / 削除 ${result.applied.delete} 件 / スキップ ${result.skipped} 件`"
        />

        <div v-if="skippedItems.length > 0" class="space-y-2">
          <h3 class="text-sm font-medium">スキップされた行</h3>
          <ul class="space-y-1">
            <li v-for="(it, i) in skippedItems" :key="i" class="text-sm">
              <UBadge :color="TYPE_COLOR[it.type]" variant="subtle" :label="TYPE_LABEL[it.type]" />
              <code class="mx-1 text-xs font-mono text-muted">{{ it.email }}</code>
              <span class="text-muted">{{ it.reason }}</span>
            </li>
          </ul>
        </div>

        <div class="flex gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-rotate-ccw"
            label="別のファイルを取り込む"
            @click="resetToUpload"
          />
          <UButton
            color="primary"
            icon="i-lucide-users"
            label="ユーザー管理へ"
            :to="`/${tenantKey}/settings/users`"
          />
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
/* 適用チェックの入った削除行は行ごと赤くする（チェックを外すと消える） */
:deep(tbody tr:has([data-row-delete])) {
  background-color: color-mix(in oklab, var(--ui-error) 10%, transparent);
}
</style>
