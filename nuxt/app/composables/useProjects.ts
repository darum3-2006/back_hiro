import { apiListProjects } from '~/api/projects';

export const useProjects = () => {
  const api = useApi();
  return useAsyncData('projects', () => apiListProjects(api), { default: () => [] });
};
