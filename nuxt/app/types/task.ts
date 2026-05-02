export interface TaskLink {
  label: string
  url: string
}

export interface Task {
  id: number
  projectId: string
  content: string
  links: TaskLink[]
  requesterMemberId: string | null
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
