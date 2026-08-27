import type { Priority, Task } from '../../lib/types'

const priorityStyle: Record<Priority, { dot: string; label: string }> = {
  low: { dot: 'bg-slate-400', label: 'Baja' },
  medium: { dot: 'bg-amber-400', label: 'Media' },
  high: { dot: 'bg-red-500', label: 'Alta' },
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function TaskCard({ task, onClick }: { task: Task; onClick?: () => void }) {
  const prio = priorityStyle[task.priority]
  const due = task.due_date ? new Date(task.due_date) : null
  return (
    <div
      onClick={onClick}
      className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-indigo-300 hover:shadow"
    >
      {task.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
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
      )}
      <p className="text-sm font-medium text-slate-800">{task.title}</p>
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className={`h-2 w-2 rounded-full ${prio.dot}`} />
          {prio.label}
          {due && (
            <span className="ml-2 text-slate-400">
              {due.toLocaleDateString('es', { day: '2-digit', month: 'short' })}
            </span>
          )}
        </span>
        {task.assignee && (
          <span
            title={task.assignee.full_name}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-semibold text-indigo-700"
          >
            {initials(task.assignee.full_name)}
          </span>
        )}
      </div>
    </div>
  )
}
