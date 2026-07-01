<script setup lang="ts">
// 目立つ見出しバー付きの折りたたみセクション。初期は開いた状態（defaultOpen）。
const props = withDefaults(
  defineProps<{
    title: string;
    icon?: string;
    defaultOpen?: boolean;
  }>(),
  { icon: undefined, defaultOpen: true },
);

const open = ref(props.defaultOpen);
</script>

<template>
  <div>
    <div class="flex items-center gap-2 rounded-md bg-elevated/60 px-3 py-2">
      <button
        type="button"
        class="flex items-center gap-1.5 text-left"
        :aria-expanded="open"
        @click="open = !open"
      >
        <UIcon v-if="icon" :name="icon" class="size-4 text-muted" />
        <span class="text-sm font-semibold">{{ title }}</span>
        <UIcon
          name="i-lucide-chevron-down"
          class="size-4 text-muted transition-transform"
          :class="open ? '' : '-rotate-90'"
        />
      </button>
      <div class="ml-auto flex items-center gap-2">
        <slot name="trailing" />
      </div>
    </div>
    <div v-show="open" class="pt-3">
      <slot />
    </div>
  </div>
</template>
