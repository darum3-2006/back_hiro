import type { Project } from '~/types/project'
import { MOCK_PROJECTS } from '~/utils/mock-projects'

/** GET /tenants/me/projects */
export const fetchProjects = async (): Promise<Project[]> => {
  return [...MOCK_PROJECTS]
}

/** POST /tenants/me/projects */
export const createProject = async (input: {
  name: string
  key: string
  description: string | null
}): Promise<Project> => {
  const nextNum =
    MOCK_PROJECTS.length === 0
      ? 1
      : Math.max(...MOCK_PROJECTS.map((p) => Number.parseInt(p.id.slice(1)) || 0)) + 1
  const project: Project = {
    id: `p${nextNum}`,
    key: input.key,
    name: input.name,
    description: input.description,
    archivedAt: null
  }
  MOCK_PROJECTS.push(project)
  return project
}

/** PATCH /tenants/me/projects/{id} */
export const updateProject = async (
  id: string,
  patch: Partial<Omit<Project, 'id'>>
): Promise<Project> => {
  const idx = MOCK_PROJECTS.findIndex((p) => p.id === id)
  if (idx < 0) throw new Error(`Project ${id} not found`)
  MOCK_PROJECTS[idx] = { ...MOCK_PROJECTS[idx]!, ...patch }
  return MOCK_PROJECTS[idx]!
}
