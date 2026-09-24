<script setup lang="ts">
import {
  DASHBOARD_DATE_FIELD_LABELS,
  DASHBOARD_DATE_FIELDS,
  type DashboardDateField,
  type DashboardSettings,
} from '~/types/user-settings';

const props = defineProps<{
  open: boolean;
  settings: DashboardSettings;
}>();

const emit = defineEmits<{
  'update:open': [boolean];
  save: [Partial<DashboardSettings>];
}>();

// 開いたときの値を下書きにする。保存するまで画面には反映しない
const draft = ref<DashboardSettings>({ ...props.settings });
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) draft.value = { ...props.settings };
  },
);

const dateFieldItems = DASHBOARD_DATE_FIELDS.map((f) => ({
  value: f,
  label: DASHBOARD_DATE_FIELD_LABELS[f],
}));

const dueSoonDayItems = Array.from({ length: 30 }, (_, i) => ({
  label: `${i + 1}日`,
  value: i + 1,
}));

const save = () => {
  emit('save', { ...draft.value });
  emit('update:open', false);
};
</script>

<template>
  <AppModal
    :open="open"
    title="ダッシュボード設定"
    :ui="{ content: 'max-w-sm' }"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField
          label="基準にする日付"
          hint="期限切れ・期限間近の判定に使います"
          help="完了日時などの過去の記録は必ず過ぎているため、選択肢に含めていません"
        >
          <USelect
            :model-value="draft.dateField"
            :items="dateFieldItems"
            value-key="value"
            class="w-full"
            @update:model-value="(v: DashboardDateField) => (draft.dateField = v)"
          />
        </UFormField>

        <UFormField label="期限間近とみなす日数" hint="今日からこの日数以内を警告します">
          <USelect
            :model-value="draft.dueSoonDays"
            :items="dueSoonDayItems"
            value-key="value"
            class="w-full"
            @update:model-value="(v: number) => (draft.dueSoonDays = v)"
          />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          label="キャンセル"
          @click="emit('update:open', false)"
        />
        <UButton color="primary" label="保存" @click="save" />
      </div>
    </template>
  </AppModal>
</template>
