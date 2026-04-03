import { NextResponse } from 'next/server'
import { buildBackendUrl } from '@/lib/backend'
import { getAccessToken } from '@/lib/authCookie'

type Params = { userId: string }

const requireToken = async (): Promise<{ token: string } | { response: NextResponse }> => {
  const token = await getAccessToken()
  if (!token) return { response: NextResponse.json({ success: false }, { status: 401 }) }
  return { token }
}

export async function GET(_request: Request, context: { params: Promise<Params> }) {
  const auth = await requireToken()
  if ('response' in auth) return auth.response

  const { userId } = await context.params

  const backendResponse = await fetch(buildBackendUrl(`/users/${userId}`), {
    headers: { Authorization: `Bearer ${auth.token}` },
    cache: 'no-store',
  })

  const json = await backendResponse.json().catch(() => null)
  return NextResponse.json(json ?? { success: false }, { status: backendResponse.status })
}

