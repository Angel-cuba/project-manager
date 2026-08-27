import { type FormEvent, useEffect, useState } from 'react'
import { Button, Modal, TextInput } from '../../components/ui'
import { errorMessage } from '../../lib/errors'
import {
  searchUsers,
  useAddMember,
  useCancelInvitation,
  useCreateInvitation,
  useInvitations,
  useMembers,
  useRemoveMember,
} from '../../lib/queries'
import type { User } from '../../lib/types'

export function MembersDialog({
  projectId,
  isOwner,
  onClose,
}: {
  projectId: string
  isOwner: boolean
  onClose: () => void
}) {
  const { data: members } = useMembers(projectId)
  const { data: invitations } = useInvitations(projectId)
  const addMember = useAddMember(projectId)
  const removeMember = useRemoveMember(projectId)
  const createInvitation = useCreateInvitation(projectId)
  const cancelInvitation = useCancelInvitation(projectId)
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<User[]>([])
  const [error, setError] = useState<string | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOwner) return
    const id = setTimeout(async () => {
      setResults(await searchUsers(term))
    }, 250)
    return () => clearTimeout(id)
  }, [term, isOwner])

  const memberIds = new Set(members?.map((m) => m.user_id))

  async function add(user: User) {
    setError(null)
    try {
      await addMember.mutateAsync(user.id)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function invite(e: FormEvent) {
    e.preventDefault()
    const email = inviteEmail.trim()
    if (!email) return
    setInviteError(null)
    try {
      await createInvitation.mutateAsync({ email })
      setInviteEmail('')
    } catch (err) {
      setInviteError(errorMessage(err))
    }
  }

  const pendingInvitations = invitations?.filter((i) => i.status === 'pending') ?? []

  return (
    <Modal title="Miembros del proyecto" onClose={onClose}>
      <div className="space-y-4">
        <ul className="space-y-2">
          {members?.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-slate-800">{m.user.full_name}</p>
                <p className="text-xs text-slate-500">{m.user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
                  {m.role}
                </span>
                {isOwner && m.role !== 'owner' && (
                  <Button
                    variant="ghost"
                    className="text-red-600"
                    onClick={() => removeMember.mutate(m.user_id)}
                  >
                    Quitar
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>

        {isOwner && (
          <div className="border-t border-slate-200 pt-3">
            <p className="mb-2 text-xs font-medium text-slate-500">Invitar por email</p>
            {inviteError && <p className="mb-2 text-sm text-red-600">{inviteError}</p>}
            <form onSubmit={invite} className="flex items-center gap-2">
              <TextInput
                type="email"
                placeholder="correo@ejemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <Button type="submit" disabled={createInvitation.isPending}>
                Invitar
              </Button>
            </form>

            {pendingInvitations.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-xs font-medium text-slate-500">
                  Invitaciones pendientes
                </p>
                <ul className="space-y-1">
                  {pendingInvitations.map((inv) => (
                    <li
                      key={inv.id}
                      className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5"
                    >
                      <span className="text-sm text-slate-700">{inv.email}</span>
                      <Button
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => cancelInvitation.mutate(inv.id)}
                      >
                        ✕
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {isOwner && (
          <div className="border-t border-slate-200 pt-3">
            <p className="mb-2 text-xs font-medium text-slate-500">Añadir miembro</p>
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            <TextInput
              placeholder="Buscar por nombre o email…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {results
                .filter((u) => !memberIds.has(u.id))
                .map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between rounded-md px-3 py-1.5 hover:bg-slate-50"
                  >
                    <span className="text-sm text-slate-700">
                      {u.full_name}{' '}
                      <span className="text-xs text-slate-400">{u.email}</span>
                    </span>
                    <Button variant="secondary" onClick={() => add(u)}>
                      Añadir
                    </Button>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}
