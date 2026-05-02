import { fetchProjects } from '~/api/projects'

export const useProjects = () => useAsyncData('projects', fetchProjects, { default: () => [] })
