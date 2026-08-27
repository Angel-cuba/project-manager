import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Button, TextInput } from '../components/ui'
import { errorMessage } from '../lib/errors'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres')
      return
    }
    setBusy(true)
    try {
      await register(email, fullName, password)
      navigate('/')
    } catch (err) {
      setError(errorMessage(err, 'No se pudo registrar'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow-sm"
      >
        <div>
          <h1 className="text-xl font-bold text-slate-800">Crear cuenta</h1>
          <p className="text-sm text-slate-500">Empieza a gestionar tus proyectos</p>
        </div>
        {error && (
          <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}
        <TextInput
          placeholder="Nombre completo"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
        <TextInput
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextInput
          type="password"
          placeholder="Contraseña (mín. 8 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? 'Creando…' : 'Registrarme'}
        </Button>
        <p className="text-center text-sm text-slate-500">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </form>
    </div>
  )
}
