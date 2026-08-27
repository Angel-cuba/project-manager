import { useState } from 'react'
import { Button, Modal, TextInput } from '../../components/ui'
import { errorMessage } from '../../lib/errors'
import {
  useCreateTask,
  useDeleteTask,
  useUpdateTask,
  type TaskInput,
} from '../../lib/queries'
import type { Label, Member, Priority, Status, Task } from '../../lib/types'

const priorities: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Baja' },
  { value: 'medium', label: 'Media' },
  { value: 'high', label: 'Alta' },
]

function toDateInput(iso: string | null): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export function TaskModal({
  projectId,
  statuses,
  members,
  labels,
  task,
  initialStatusId,
  onClose,
}: {
  projectId: string
  statuses: Status[]
  members: Member[]
  labels: Label[]
  task?: Task
  initialStatusId?: string
  onClose: () => void
}) {
  const editing = Boolean(task)
  const createTask = useCreateTask(projectId)
  const updateTask = useUpdateTask(projectId)
  const deleteTask = useDeleteTask(projectId)

  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [statusId, setStatusId] = useState(
    task?.status_id ?? initialStatusId ?? statuses[0]?.id ?? '',
  )
  const [assigneeId, setAssigneeId] = useState(task?.assignee_id ?? '')
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 'medium')
  const [dueDate, setDueDate] = useState(toDateInput(task?.due_date ?? null))
  const [labelIds, setLabelIds] = useState<string[]>(
    task?.labels.map((l) => l.id) ?? [],
  )
  const [error, setError] = useState<string | null>(null)

  function toggleLabel(id: string) {
    setLabelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function onSave() {
    setError(null)
    const body: TaskInput = {
      title,
      description: description || null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      status_id: statusId,
      assignee_id: assigneeId || null,
      priority,
      label_ids: labelIds,
    }
    try {
      if (editing && task) {
        await updateTask.mutateAsync({ id: task.id, ...body })
      } else {
        await createTask.mutateAsync(body)
      }
      onClose()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function onDelete() {
    if (!task) return
    if (!confirm('¿Eliminar esta tarea?')) return
    await deleteTask.mutateAsync(task.id)
    onClose()
  }

  const selectCls =
    'w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500'

  return (
    <Modal
      title={editing ? 'Editar tarea' : 'Nueva tarea'}
      onClose={onClose}
      footer={
        <>
          {editing && (
            <Button variant="danger" className="mr-auto" onClick={onDelete}>
              Eliminar
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={!title}>
            {editing ? 'Guardar' : 'Crear'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        <TextInput
          placeholder="Título"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        <textarea
          className={selectCls}
          placeholder="Descripción"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-slate-500">
            Estado
            <select
              className={selectCls}
              value={statusId}
              onChange={(e) => setStatusId(e.target.value)}
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            Prioridad
            <select
              className={selectCls}
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
            >
              {priorities.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            Asignado
            <select
              className={selectCls}
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
            >
              <option value="">Sin asignar</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user.full_name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-500">
            Fecha límite
            <input
              type="date"
              className={selectCls}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        </div>
        {labels.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Etiquetas</p>
            <div className="flex flex-wrap gap-1.5">
              {labels.map((l) => {
                const active = labelIds.includes(l.id)
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggleLabel(l.id)}
                    className={`rounded px-2 py-1 text-xs font-medium transition ${
                      active ? 'text-white' : 'text-slate-600 ring-1 ring-slate-300'
                    }`}
                    style={active ? { backgroundColor: l.color } : undefined}
                  >
                    {l.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
