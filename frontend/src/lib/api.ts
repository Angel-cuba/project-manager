import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { AuthResponse } from './types'

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

const ACCESS_KEY = 'am_access'
const REFRESH_KEY = 'am_refresh'

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY)
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY)
  },
  set(tokens: { access_token: string; refresh_token: string }) {
    localStorage.setItem(ACCESS_KEY, tokens.access_token)
    localStorage.setItem(REFRESH_KEY, tokens.refresh_token)
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

export const api = axios.create({ baseURL: `${API_URL}/api` })

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.access
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// On 401, try to refresh the access token once, then replay the request.
let refreshing: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStore.refresh
  if (!refresh) return null
  try {
    const { data } = await axios.post<AuthResponse>(`${API_URL}/api/auth/refresh`, {
      refresh_token: refresh,
    })
    tokenStore.set(data)
    return data.access_token
  } catch {
    tokenStore.clear()
    return null
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true
      refreshing = refreshing ?? refreshAccessToken()
      const newToken = await refreshing
      refreshing = null
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`
        return api(original)
      }
      // Refresh failed: force back to login.
      if (location.pathname !== '/login') location.href = '/login'
    }
    return Promise.reject(error)
  },
)
