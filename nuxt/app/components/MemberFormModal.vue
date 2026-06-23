<script setup lang="ts">
import { apiCreateMember, apiUpdateMember } from '~/api/members';
import type { Member, MemberRole } from '~/types/member';
import type { User } from '~/types/master';

const api = useApi();
const toast = useToast();

const props = defineProps<{
  open: boolean;
  projectId: string;
  member: Member | null;
  users: User[];
  existingUserIds: string[];
}>();

const emit = defineEmits<{
  'update:open': [boolean];
  saved: [Member];
}>();

interface Draft {
  displayName: string;
  userId: string | null;
  role: MemberRole;
}

const draft = ref<Draft>({ displayName: '', userId: null, role: 'member' });
const submitting = ref(false);

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return;
    if (props.member) {
      draft.value = {
        displayName: props.member.displayName,
        userId: props.member.userId,
        role: props.member.role,
      };
    } else {
      draft.value = { displayName: '', userId: null, role: 'member' };
    }
  },
);

const canSubmit = computed(() => Boolean(draft.value.displayName.trim()));

const isEdit = computed(() => Boolean(props.member));

const userSelectItems = computed(() => {
  // 編集時は自分が紐付けてる User も候補に残す
  const allowedUserIds = new Set(
    props.users
      .filter(
        (u) => !props.existingUserIds.includes(u.id) || u.id === (props.member?.userId ?? null),
      )
      .map((u) => u.id),
  );
  return props.users
    .filter((u) => allowedUserIds.has(u.id))
    .map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }));
});

const roleSelectItems = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
];

const submit = async () => {
  if (!canSubmit.value) return;
  submitting.value = true;
  try {
    const payload = {
      displayName: draft.value.displayName.trim(),
      userId: draft.value.userId,
      role: draft.value.role,
    };
    const result: Member = props.member
      ? await apiUpdateMember(api, props.projectId, props.member.id, payload)
      : await apiCreateMember(api, props.projectId, payload);
    emit('saved', result);
    emit('update:open', false);
  } catch (e: unknown) {
    const raw =
      typeof e === 'object' && e !== null && 'data' in e
        ? (e as { data?: { message?: string | string[] } }).data?.message
        : undefined;
    const message = Array.isArray(raw) ? raw.join(', ') : (raw ?? 'メンバーの保存に失敗しました');
    toast.add({ title: message, color: 'error' });
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <AppModal
    :open="open"
    :title="isEdit ? 'メンバーを編集' : '新規メンバー'"
    @update:open="(v: boolean) => emit('update:open', v)"
  >
    <template #body>
      <div class="space-y-4">
        <UFormField label="表示名" required>
          <UInput
            v-model="draft.displayName"
            autofocus
            placeholder="例: 田中健太、CS（起票）"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="User 紐付け"
          description="認証ユーザーと紐付けると、そのユーザーが操作できるようになります"
          :ui="{ description: 'text-xs' }"
        >
          <SelectMenu
            :items="userSelectItems"
            :current="draft.userId"
            allow-none
            none-label="紐付けなし"
            default-icon="i-lucide-user"
            @select="(c: string | null) => (draft.userId = c)"
          >
            <UButton
              color="neutral"
              variant="outline"
              block
              class="justify-between"
              trailing-icon="i-lucide-chevrons-up-down"
            >
              <span class="truncate">{{
                draft.userId
                  ? (users.find((u) => u.id === draft.userId)?.name ?? draft.userId)
                  : '紐付けなし'
              }}</span>
            </UButton>
          </SelectMenu>
        </UFormField>
        <UFormField label="権限">
          <SelectMenu
            :items="roleSelectItems"
            :current="draft.role"
            default-icon="i-lucide-shield"
            @select="(c: string | null) => c && (draft.role = c as MemberRole)"
          >
            <UButton
              color="neutral"
              variant="outline"
              block
              class="justify-between"
              trailing-icon="i-lucide-chevrons-up-down"
            >
              {{ draft.role === 'admin' ? 'Admin' : 'Member' }}
            </UButton>
          </SelectMenu>
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2 w-full">
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
          :label="isEdit ? '保存' : '追加'"
          @click="submit"
        />
      </div>
    </template>
  </AppModal>
</template>
