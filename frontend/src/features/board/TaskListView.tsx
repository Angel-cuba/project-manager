import { useMemo } from 'react'
import type { Member, Priority, Status, Task } from '../../lib/types'

const priorityStyle: Record<Priority, { dot: string; label: string }> = {
  low: { dot: 'bg-slate-400', label: 'Baja' },
  medium: { dot: 'bg-amber-400', label: 'Media' },
  high: { dot: 'bg-red-500', label: 'Alta' },
}

export function TaskListView({
  statuses,
  tasks,
  members,
  onTaskClick,
}: {
  statuses: Status[]
  tasks: Task[]
  members: Member[]
  onTaskClick: (task: Task) => void
}) {
  const statusById = useMemo(
    () => Object.fromEntries(statuses.map((s) => [s.id, s])),
    [statuses],
  )

  // Members are accepted for parity with the board data set; assignee names come
  // straight off each task, but we keep a lookup as a fallback for assignee_id.
  const memberById = useMemo(
    () => Object.fromEntries(members.map((m) => [m.user_id, m])),
    [members],
  )

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const sa = statusById[a.status_id]?.position ?? Number.MAX_SAFE_INTEGER
      const sb = statusById[b.status_id]?.position ?? Number.MAX_SAFE_INTEGER
      if (sa !== sb) return sa - sb
      return a.position - b.position
    })
  }, [tasks, statusById])

  function assigneeName(task: Task): string {
    if (task.assignee) return task.assignee.full_name
    if (task.assignee_id) {
      const m = memberById[task.assignee_id]
      if (m) return m.user.full_name
    }
    return '—'
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <th className="px-4 py-3">Título</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Asignado</th>
            <th className="px-4 py-3">Prioridad</th>
            <th className="px-4 py-3">Fecha límite</th>
            <th className="px-4 py-3">Etiquetas</th>
          </tr>
        </thead>
        <tbody>
          {sortedTasks.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                No hay tareas todavía.
              </td>
            </tr>
          ) : (
            sortedTasks.map((task) => {
              const status = statusById[task.status_id]
              const prio = priorityStyle[task.priority]
              const due = task.due_date ? new Date(task.due_date) : null
              return (
                <tr
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  className="cursor-pointer border-b border-slate-100 transition last:border-b-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {task.title}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {status ? (
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        {status.name}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{assigneeName(task)}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${prio.dot}`} />
                      {prio.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {due
                      ? due.toLocaleDateString('es', {
                          day: '2-digit',
                          month: 'short',
                        })
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {task.labels.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {task.labels.map((l) => (
                          <span
                            key={l.id}
                            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                            style={{ backgroundColor: l.color }}
                          >
                            {l.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
