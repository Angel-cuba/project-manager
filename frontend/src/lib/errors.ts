import { AxiosError } from 'axios'

/** Extract a human-readable message from an API/Axios error. */
export function errorMessage(err: unknown, fallback = 'Algo salió mal'): string {
  if (err instanceof AxiosError) {
    const detail = err.response?.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg
    if (err.message) return err.message
  }
  if (err instanceof Error) return err.message
  return fallback
}
