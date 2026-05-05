<script setup lang="ts">
const route = useRoute();
const tenantKey = computed(() => route.params.tenantKey as string);

const { data: projects } = await useProjects();
const firstActive = projects.value.find((p) => !p.archivedAt);
await navigateTo(
  firstActive
    ? `/${tenantKey.value}/projects/${firstActive.id}/tasks`
    : `/${tenantKey.value}/projects`,
  { replace: true },
);
</script>

<template>
  <div />
</template>
