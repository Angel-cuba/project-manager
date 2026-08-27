import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-500">
        Cargando…
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}
