import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { API_URL, tokenStore } from '../../lib/api'
import { qk } from '../../lib/queries'

interface BoardEvent {
  event: string
  payload: unknown
}

/**
 * Subscribes to the project's realtime channel. On any board event it
 * invalidates the relevant React Query caches so every connected client
 * converges on the same state. Returns the live connection status.
 */
export function useProjectSocket(projectId: string) {
  const qc = useQueryClient()
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const token = tokenStore.access
    if (!token) return

    const wsBase = API_URL.replace(/^http/, 'ws')
    const ws = new WebSocket(
      `${wsBase}/ws/projects/${projectId}?token=${encodeURIComponent(token)}`,
    )
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (e) => {
      let msg: BoardEvent
      try {
        msg = JSON.parse(e.data)
      } catch {
        return
      }
      if (msg.event.startsWith('task')) {
        qc.invalidateQueries({ queryKey: qk.tasks(projectId) })
      } else if (msg.event.startsWith('status')) {
        qc.invalidateQueries({ queryKey: qk.statuses(projectId) })
        qc.invalidateQueries({ queryKey: qk.tasks(projectId) })
      } else if (msg.event.startsWith('label')) {
        qc.invalidateQueries({ queryKey: qk.labels(projectId) })
        qc.invalidateQueries({ queryKey: qk.tasks(projectId) })
      }
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [projectId, qc])

  return { connected }
}
