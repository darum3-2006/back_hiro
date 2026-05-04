<script setup lang="ts">
defineProps<{
  icon?: string;
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
    <UIcon v-if="icon" :name="icon" class="size-10 text-muted mb-3" />
    <h3 class="text-base font-medium mb-1">{{ title }}</h3>
    <p v-if="description" class="text-sm text-muted mb-4 max-w-md whitespace-pre-line">
      {{ description }}
    </p>
    <slot />
  </div>
</template>
