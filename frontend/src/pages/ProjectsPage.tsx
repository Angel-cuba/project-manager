import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Button, Modal, TextInput } from '../components/ui'
import { errorMessage } from '../lib/errors'
import { useCreateProject, useProjects } from '../lib/queries'

export function ProjectsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { data: projects, isLoading } = useProjects()
  const createProject = useCreateProject()
  const [showNew, setShowNew] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onCreate() {
    setError(null)
    try {
      const project = await createProject.mutateAsync({ name, description })
      setShowNew(false)
      setName('')
      setDescription('')
      navigate(`/projects/${project.id}`)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-bold text-slate-800">Mis proyectos</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-500">{user?.full_name}</span>
            <Button variant="ghost" onClick={logout}>
              Salir
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex justify-end">
          <Button onClick={() => setShowNew(true)}>+ Nuevo proyecto</Button>
        </div>

        {isLoading ? (
          <p className="text-slate-500">Cargando…</p>
        ) : projects && projects.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate(`/projects/${p.id}`)}
                className="rounded-xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-indigo-300 hover:shadow"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">{p.name}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                    {p.role}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                  {p.description || 'Sin descripción'}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            Aún no tienes proyectos. Crea el primero.
          </div>
        )}
      </main>

      {showNew && (
        <Modal
          title="Nuevo proyecto"
          onClose={() => setShowNew(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowNew(false)}>
                Cancelar
              </Button>
              <Button onClick={onCreate} disabled={!name || createProject.isPending}>
                Crear
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <TextInput
              placeholder="Nombre del proyecto"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            <textarea
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              placeholder="Descripción (opcional)"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </Modal>
      )}
    </div>
  )
}
