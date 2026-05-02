export interface Task {
  id: number
  projectId: string
  content: string
  trelloUrl: string | null
  requesterMemberId: string
  requestingDeptCode: string | null
  assigneeMemberId: string
  priorityCode: string | null
  statusCode: string
  deadline: string | null
  plannedCompletionDate: string | null
  tagCodes: string[]
  description: string
  createdAt: string
}
