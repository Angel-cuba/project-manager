import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { api } from './api'
import type {
  Label,
  Member,
  Priority,
  Project,
  Status,
  Task,
  User,
} from './types'

export const qk = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  statuses: (id: string) => ['projects', id, 'statuses'] as const,
  labels: (id: string) => ['projects', id, 'labels'] as const,
  tasks: (id: string) => ['projects', id, 'tasks'] as const,
  members: (id: string) => ['projects', id, 'members'] as const,
}

// --- Projects ---
export function useProjects() {
  return useQuery({
    queryKey: qk.projects,
    queryFn: async () => (await api.get<Project[]>('/projects')).data,
  })
}

export function useProject(id: string) {
  return useQuery({
    queryKey: qk.project(id),
    queryFn: async () => (await api.get<Project>(`/projects/${id}`)).data,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { name: string; description?: string }) =>
      (await api.post<Project>('/projects', body)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.projects }),
  })
}

// --- Statuses ---
export function useStatuses(projectId: string) {
  return useQuery({
    queryKey: qk.statuses(projectId),
    queryFn: async () =>
      (await api.get<Status[]>(`/projects/${projectId}/statuses`)).data,
  })
}

export function useCreateStatus(projectId: string) {
  return useMutation({
    mutationFn: async (body: { name: string; color: string }) =>
      (await api.post<Status>(`/projects/${projectId}/statuses`, body)).data,
  })
}

export function useUpdateStatus(projectId: string) {
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; name?: string; color?: string }) =>
      (await api.patch<Status>(`/projects/${projectId}/statuses/${id}`, body)).data,
  })
}

export function useDeleteStatus(projectId: string) {
  return useMutation({
    mutationFn: async (id: string) =>
      api.delete(`/projects/${projectId}/statuses/${id}`),
  })
}

export function useReorderStatuses(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderedIds: string[]) =>
      (await api.post<Status[]>(`/projects/${projectId}/statuses/reorder`, orderedIds))
        .data,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.statuses(projectId) }),
  })
}

// --- Labels ---
export function useLabels(projectId: string) {
  return useQuery({
    queryKey: qk.labels(projectId),
    queryFn: async () =>
      (await api.get<Label[]>(`/projects/${projectId}/labels`)).data,
  })
}

export function useCreateLabel(projectId: string) {
  return useMutation({
    mutationFn: async (body: { name: string; color: string }) =>
      (await api.post<Label>(`/projects/${projectId}/labels`, body)).data,
  })
}

export function useDeleteLabel(projectId: string) {
  return useMutation({
    mutationFn: async (id: string) =>
      api.delete(`/projects/${projectId}/labels/${id}`),
  })
}

// --- Tasks ---
export interface TaskInput {
  title: string
  description?: string | null
  due_date?: string | null
  status_id?: string | null
  assignee_id?: string | null
  priority?: Priority
  label_ids?: string[]
}

export function useTasks(projectId: string) {
  return useQuery({
    queryKey: qk.tasks(projectId),
    queryFn: async () =>
      (await api.get<Task[]>(`/projects/${projectId}/tasks`)).data,
  })
}

export function useCreateTask(projectId: string) {
  return useMutation({
    mutationFn: async (body: TaskInput) =>
      (await api.post<Task>(`/projects/${projectId}/tasks`, body)).data,
  })
}

export function useUpdateTask(projectId: string) {
  return useMutation({
    mutationFn: async ({ id, ...body }: TaskInput & { id: string }) =>
      (await api.patch<Task>(`/projects/${projectId}/tasks/${id}`, body)).data,
  })
}

export function useMoveTask(projectId: string) {
  return useMutation({
    mutationFn: async (body: { id: string; status_id: string; position: number }) =>
      (
        await api.patch<Task>(`/projects/${projectId}/tasks/${body.id}/move`, {
          status_id: body.status_id,
          position: body.position,
        })
      ).data,
  })
}

export function useDeleteTask(projectId: string) {
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/projects/${projectId}/tasks/${id}`),
  })
}

// --- Members ---
export function useMembers(projectId: string) {
  return useQuery({
    queryKey: qk.members(projectId),
    queryFn: async () =>
      (await api.get<Member[]>(`/projects/${projectId}/members`)).data,
  })
}

export function useAddMember(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) =>
      (
        await api.post<Member>(`/projects/${projectId}/members`, {
          user_id: userId,
          role: 'member',
        })
      ).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.members(projectId) }),
  })
}

export function useRemoveMember(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) =>
      api.delete(`/projects/${projectId}/members/${userId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.members(projectId) }),
  })
}

export async function searchUsers(term: string): Promise<User[]> {
  return (await api.get<User[]>('/users', { params: { search: term } })).data
}
