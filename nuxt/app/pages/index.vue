<script setup lang="ts">
const { data: projects } = await useProjects();
const firstActive = projects.value.find((p) => !p.archivedAt);
await navigateTo(firstActive ? `/projects/${firstActive.id}/tasks` : '/projects', {
  replace: true
});
</script>

<template>
  <div />
</template>
