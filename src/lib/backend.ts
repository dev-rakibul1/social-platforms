const normalizeBaseUrl = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, '')
  return trimmed || 'http://localhost:5000/api/v1'
}

export const BACKEND_API_BASE_URL = normalizeBaseUrl(
  process.env.BACKEND_API_URL ?? 'http://localhost:5000/api/v1'
)

export const buildBackendUrl = (path: string): string => {
  const base = `${BACKEND_API_BASE_URL}/`
  const normalizedPath = path.replace(/^\/+/, '')
  return new URL(normalizedPath, base).toString()
}

