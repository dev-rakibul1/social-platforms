import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import FeedClient from './FeedClient'

const normalizeBaseUrl = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, '')
  return trimmed
}

const getBackendOrigin = (): string => {
  const apiBase = normalizeBaseUrl(
    process.env.BACKEND_API_URL ?? 'https://testapi.bpsnx.com/api/v1/',
  )

  try {
    return new URL(apiBase).origin
  } catch {
    return 'https://testapi.bpsnx.com/'
  }
}

export default async function FeedPage() {
  const store = await cookies()
  const token = store.get('access_token')?.value ?? null

  if (!token) {
    redirect('/login?reason=auth&next=/feed')
  }

  return <FeedClient backendOrigin={getBackendOrigin()} />
}
