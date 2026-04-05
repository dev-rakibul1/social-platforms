import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import UserProfileClient from './UserProfileClient'

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

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const store = await cookies()
  const token = store.get('access_token')?.value ?? null

  if (!token) {
    const { userId } = await params
    redirect(`/login?reason=auth&next=/u/${encodeURIComponent(userId)}`)
  }

  return <UserProfileClient backendOrigin={getBackendOrigin()} />
}
