export interface User {
  id: string
  email: string
  full_name: string
  created_at: string
}

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export type Role = 'owner' | 'member'

export interface Project {
  id: string
  name: string
  description: string | null
  owner_id: string
  created_at: string
  role: Role | null
}

export interface Member {
  id: string
  user_id: string
  role: Role
  user: User
}

export interface Status {
  id: string
  project_id: string
  name: string
  color: string
  position: number
}

export interface Label {
  id: string
  project_id: string
  name: string
  color: string
}

export type Priority = 'low' | 'medium' | 'high'

export interface Task {
  id: string
  project_id: string
  title: string
  description: string | null
  due_date: string | null
  status_id: string
  assignee_id: string | null
  assignee: User | null
  priority: Priority
  position: number
  labels: Label[]
  created_by: string | null
  created_at: string
  updated_at: string
}
