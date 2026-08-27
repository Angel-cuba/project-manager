import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Button, Modal, TextInput } from '../../components/ui'
import { errorMessage } from '../../lib/errors'
import {
  qk,
  useCreateLabel,
  useCreateStatus,
  useDeleteLabel,
  useDeleteStatus,
  useLabels,
  useReorderStatuses,
  useStatuses,
  useUpdateStatus,
} from '../../lib/queries'

export function BoardSettingsDialog({
  projectId,
  onClose,
}: {
  projectId: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: statuses } = useStatuses(projectId)
  const { data: labels } = useLabels(projectId)
  const createStatus = useCreateStatus(projectId)
  const updateStatus = useUpdateStatus(projectId)
  const deleteStatus = useDeleteStatus(projectId)
  const reorderStatuses = useReorderStatuses(projectId)
  const createLabel = useCreateLabel(projectId)
  const deleteLabel = useDeleteLabel(projectId)

  const [newStatus, setNewStatus] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [newLabelColor, setNewLabelColor] = useState('#6366f1')
  const [error, setError] = useState<string | null>(null)

  const refreshStatuses = () =>
    qc.invalidateQueries({ queryKey: qk.statuses(projectId) })
  const refreshLabels = () => qc.invalidateQueries({ queryKey: qk.labels(projectId) })

  async function run(fn: () => Promise<unknown>, after: () => void) {
    setError(null)
    try {
      await fn()
      after()
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  // Move a status up (-1) or down (+1) by swapping it with its neighbour.
  function moveStatus(index: number, direction: -1 | 1) {
    if (!statuses) return
    const target = index + direction
    if (target < 0 || target >= statuses.length) return
    const ids = statuses.map((s) => s.id)
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    run(() => reorderStatuses.mutateAsync(ids), refreshStatuses)
  }

  return (
    <Modal title="Ajustes del tablero" onClose={onClose}>
      <div className="space-y-6">
        {error && <p className="text-sm text-red-600">{error}</p>}

        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Estados (columnas)</h3>
          <ul className="space-y-2">
            {statuses?.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2">
                <div className="flex flex-col leading-none">
                  <button
                    type="button"
                    onClick={() => moveStatus(i, -1)}
                    disabled={i === 0}
                    aria-label="Subir estado"
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStatus(i, 1)}
                    disabled={i === statuses.length - 1}
                    aria-label="Bajar estado"
                    className="text-slate-400 hover:text-slate-700 disabled:opacity-30"
                  >
                    ▼
                  </button>
                </div>
                <input
                  type="color"
                  value={s.color}
                  onChange={(e) =>
                    run(
                      () => updateStatus.mutateAsync({ id: s.id, color: e.target.value }),
                      refreshStatuses,
                    )
                  }
                  className="h-8 w-8 cursor-pointer rounded border border-slate-200"
                />
                <input
                  defaultValue={s.name}
                  onBlur={(e) => {
                    if (e.target.value && e.target.value !== s.name)
                      run(
                        () =>
                          updateStatus.mutateAsync({ id: s.id, name: e.target.value }),
                        refreshStatuses,
                      )
                  }}
                  className="flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm"
                />
                <Button
                  variant="ghost"
                  className="text-red-600"
                  onClick={() =>
                    run(() => deleteStatus.mutateAsync(s.id), refreshStatuses)
                  }
                >
                  ✕
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <TextInput
              placeholder="Nuevo estado…"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
            />
            <Button
              onClick={() =>
                run(
                  () => createStatus.mutateAsync({ name: newStatus, color: '#94a3b8' }),
                  () => {
                    setNewStatus('')
                    refreshStatuses()
                  },
                )
              }
              disabled={!newStatus}
            >
              Añadir
            </Button>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">Etiquetas</h3>
          <div className="flex flex-wrap gap-1.5">
            {labels?.map((l) => (
              <span
                key={l.id}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: l.color }}
              >
                {l.name}
                <button
                  onClick={() =>
                    run(() => deleteLabel.mutateAsync(l.id), refreshLabels)
                  }
                  className="opacity-80 hover:opacity-100"
                  aria-label="Eliminar etiqueta"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              type="color"
              value={newLabelColor}
              onChange={(e) => setNewLabelColor(e.target.value)}
              className="h-9 w-9 cursor-pointer rounded border border-slate-200"
            />
            <TextInput
              placeholder="Nueva etiqueta…"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
            <Button
              onClick={() =>
                run(
                  () =>
                    createLabel.mutateAsync({ name: newLabel, color: newLabelColor }),
                  () => {
                    setNewLabel('')
                    refreshLabels()
                  },
                )
              }
              disabled={!newLabel}
            >
              Añadir
            </Button>
          </div>
        </section>
      </div>
    </Modal>
  )
}
