import axios from 'axios'

export const API_URL =
  import.meta.env.VITE_API_URL ||
  'http://127.0.0.1:8001'

let tokenAdmin: string | null = null

export function guardarToken(token: string) {
  tokenAdmin = token
}

export function obtenerToken() {
  return tokenAdmin
}

export function eliminarToken() {
  tokenAdmin = null
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = obtenerToken()

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401 &&
      obtenerToken()
    ) {
      eliminarToken()

      window.dispatchEvent(
        new Event('sesion-expirada'),
      )
    }

    return Promise.reject(error)
  },
)

export default api