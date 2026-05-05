<script setup lang="ts">
const route = useRoute();
const tenantKey = computed(() => route.params.tenantKey as string);
const { data: projects } = await useProjects();

onMounted(() => {
  const firstActive = projects.value.find((p) => !p.archivedAt);
  const dest = firstActive
    ? `/${tenantKey.value}/projects/${firstActive.id}/tasks`
    : `/${tenantKey.value}/projects`;
  navigateTo(dest, { replace: true });
});
</script>

<template>
  <div />
</template>
