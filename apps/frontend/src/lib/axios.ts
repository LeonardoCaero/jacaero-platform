import axios from 'axios'
import { tokenStorage } from './token-storage'
import { getCurrentEndpoint } from './push'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

api.interceptors.request.use(async (config) => {
  const accessToken = tokenStorage.getAccessToken()
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  const endpoint = await getCurrentEndpoint().catch(() => null)
  if (endpoint) {
    config.headers['X-Push-Endpoint'] = endpoint
  }
  return config
})

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStorage.getRefreshToken()
  if (!refreshToken) return null

  try {
    const { data } = await axios.post(`${import.meta.env.VITE_API_URL}/auth/refresh`, { refreshToken })
    tokenStorage.setTokens(data.accessToken, data.refreshToken)
    return data.accessToken
  } catch {
    tokenStorage.clear()
    return null
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null
      })

      const newAccessToken = await refreshPromise
      if (newAccessToken) {
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return api(originalRequest)
      }

      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)
