export const useCurrentProjectId = () => {
  const route = useRoute();
  return computed(() => (route.params.projectId as string | undefined) ?? '');
};
