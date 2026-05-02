import type { Project } from '~/types/project'
import { MOCK_PROJECTS } from '~/utils/mock-projects'

/** GET /tenants/me/projects */
export async function fetchProjects(): Promise<Project[]> {
  return [...MOCK_PROJECTS]
}
