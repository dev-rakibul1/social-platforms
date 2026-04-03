import { NextResponse } from 'next/server'
import { buildBackendUrl } from '@/lib/backend'
import { getAccessToken } from '@/lib/authCookie'

type Params = { postId: string }

const requireToken = async (): Promise<{ token: string } | { response: NextResponse }> => {
  const token = await getAccessToken()
  if (!token) return { response: NextResponse.json({ success: false }, { status: 401 }) }
  return { token }
}

export async function PATCH(request: Request, context: { params: Promise<Params> }) {
  const auth = await requireToken()
  if ('response' in auth) return auth.response

  const { postId } = await context.params
  const body = await request.json().catch(() => null)

  const backendResponse = await fetch(buildBackendUrl(`/posts/${postId}`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`,
    },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
  })

  const json = await backendResponse.json().catch(() => null)
  return NextResponse.json(json ?? { success: false }, { status: backendResponse.status })
}

