export interface TaskStatus {
  projectId: string
  code: string
  label: string
  color: 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'error'
  order: number
  isTerminal: boolean
}

export interface TaskPriority {
  projectId: string
  code: string
  label: string
  color: 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'error'
  order: number
}

export interface Tag {
  projectId: string
  code: string
  name: string
  color: 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'error'
}

export interface Department {
  code: string
  name: string
}

export interface User {
  id: string
  name: string
  email: string
}
