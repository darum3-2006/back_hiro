import type { Member } from '~/types/member'
import { MOCK_MEMBERS } from '~/utils/mock-members'

/** GET /projects/{projectId}/members */
export async function fetchMembers(projectId: string): Promise<Member[]> {
  return MOCK_MEMBERS.filter(m => m.projectId === projectId)
}
