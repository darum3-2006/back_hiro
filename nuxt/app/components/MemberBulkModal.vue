<script setup lang="ts">
import { apiBulkCreateMembers } from '~/api/members';
import type { Member, MemberRole } from '~/types/member';

const api = useApi();
const toast = useToast();

const props = defineProps<{
  open: boolean;
  projectId: string;
}>();

const emit = defineEmits<{
  'update:open': [boolean];
  saved: [Member[]];
}>();

const roleSelectItems = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
];

const text = ref('');
const role = ref<MemberRole>('member');
const submitting = ref(false);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    text.value = '';
    role.value = 'member';
  },
);

// 1 行 1 件。空行・前後空白は除外。
const names = computed(() =>
  text.value
    .split('\n')
    .map((n) => n.trim())
    .filter((n) => n.length > 0),
);
const canSubmit = computed(() => names.value.length > 0 && !submitting.value);

const submit = async () => {
  if (!canSubmit.value) return;
  submitting.value = true;
  try {
    const created = await apiBulkCreateMembers(api, props.projectId, {
      displayNames: names.value,
      role: role.value,
    });
    emit('saved', created);
    emit('update:open', false);
    toast.add({
      title: `${created.length} 人のメンバーを追加しました`,
      color: 'success',
      icon: 'i-lucide-check',
    });
  } catch {
    toast.add({ title: 'メンバーの一括追加に失敗しました', color: 'error' });
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <AppModal
    :open="open"
    title="メンバーを一括追加"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField
          label="表示名（1 行に 1 件）"
          description="User 紐付けは無しで作成されます。空行は無視されます。"
          :ui="{ description: 'text-xs' }"
          required
        >
          <UTextarea
            v-model="text"
            :rows="8"
            autofocus
            placeholder="田中健太&#10;CS（起票）&#10;かんとく"
            class="w-full"
          />
        </UFormField>
        <UFormField label="権限（全員に適用）">
          <SelectMenu
            :items="roleSelectItems"
            :current="role"
            default-icon="i-lucide-shield"
            @select="(c: string | null) => c && (role = c as MemberRole)"
          >
            <UButton
              color="neutral"
              variant="outline"
              block
              class="justify-between"
              trailing-icon="i-lucide-chevrons-up-down"
            >
              {{ role === 'admin' ? 'Admin' : 'Member' }}
            </UButton>
          </SelectMenu>
        </UFormField>
        <p class="text-sm text-muted">{{ names.length }} 件を追加します</p>
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
        <UButton
          color="primary"
          :loading="submitting"
          :disabled="!canSubmit"
          :label="`${names.length} 件を追加`"
          @click="submit"
        />
      </div>
    </template>
  </AppModal>
</template>
