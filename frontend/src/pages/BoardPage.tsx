import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button } from '../components/ui'
import { BoardSettingsDialog } from '../features/board/BoardSettingsDialog'
import { KanbanBoard } from '../features/board/KanbanBoard'
import { TaskListView } from '../features/board/TaskListView'
import { TaskModal } from '../features/board/TaskModal'
import { useProjectSocket } from '../features/board/useProjectSocket'
import { MembersDialog } from '../features/members/MembersDialog'
import {
  useLabels,
  useMembers,
  useProject,
  useStatuses,
  useTasks,
} from '../lib/queries'
import type { Task } from '../lib/types'

export function BoardPage() {
  const { projectId = '' } = useParams()
  const { connected } = useProjectSocket(projectId)
  const { data: project } = useProject(projectId)
  const { data: statuses } = useStatuses(projectId)
  const { data: tasks } = useTasks(projectId)
  const { data: members } = useMembers(projectId)
  const { data: labels } = useLabels(projectId)

  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [creating, setCreating] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [view, setView] = useState<'board' | 'list'>('board')

  const isOwner = project?.role === 'owner'
  const ready = statuses && tasks && members && labels

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link to="/" className="text-slate-400 hover:text-slate-600">
            ←
          </Link>
          <h1 className="text-lg font-bold text-slate-800">{project?.name ?? '…'}</h1>
          <span
            title={connected ? 'Tiempo real conectado' : 'Sin conexión en tiempo real'}
            className={`flex items-center gap-1 text-xs ${
              connected ? 'text-green-600' : 'text-slate-400'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? 'bg-green-500' : 'bg-slate-300'
              }`}
            />
            {connected ? 'En vivo' : 'Desconectado'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-md border border-slate-300 p-0.5">
              <button
                onClick={() => setView('board')}
                className={`rounded px-3 py-1 text-sm font-medium transition ${
                  view === 'board'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Tablero
              </button>
              <button
                onClick={() => setView('list')}
                className={`rounded px-3 py-1 text-sm font-medium transition ${
                  view === 'list'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Lista
              </button>
            </div>
            <Button variant="secondary" onClick={() => setShowMembers(true)}>
              Miembros
            </Button>
            <Button variant="secondary" onClick={() => setShowSettings(true)}>
              Ajustes
            </Button>
            <Button onClick={() => setCreating(true)} disabled={!statuses?.length}>
              + Tarea
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-x-auto p-4">
        {!ready ? (
          <p className="text-slate-500">Cargando tablero…</p>
        ) : statuses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            Crea un estado en Ajustes para empezar.
          </div>
        ) : view === 'board' ? (
          <KanbanBoard
            statuses={statuses}
            tasks={tasks}
            onTaskClick={(t) => setEditingTask(t)}
          />
        ) : (
          <TaskListView
            statuses={statuses}
            tasks={tasks}
            members={members}
            onTaskClick={(t) => setEditingTask(t)}
          />
        )}
      </main>

      {ready && (creating || editingTask) && (
        <TaskModal
          projectId={projectId}
          statuses={statuses}
          members={members}
          labels={labels}
          task={editingTask ?? undefined}
          onClose={() => {
            setCreating(false)
            setEditingTask(null)
          }}
        />
      )}

      {showMembers && (
        <MembersDialog
          projectId={projectId}
          isOwner={!!isOwner}
          onClose={() => setShowMembers(false)}
        />
      )}

      {showSettings && (
        <BoardSettingsDialog
          projectId={projectId}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
