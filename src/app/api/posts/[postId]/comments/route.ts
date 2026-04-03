import { NextResponse } from 'next/server'
import { buildBackendUrl } from '@/lib/backend'
import { getAccessToken } from '@/lib/authCookie'

type Params = { postId: string }

const requireToken = async (): Promise<{ token: string } | { response: NextResponse }> => {
  const token = await getAccessToken()
  if (!token) return { response: NextResponse.json({ success: false, message: 'Unauthorized.' }, { status: 401 }) }
  return { token }
}

export async function GET(request: Request, context: { params: Promise<Params> }) {
  const auth = await requireToken()
  if ('response' in auth) return auth.response

  const { postId } = await context.params

  try {
    const url = new URL(request.url)
    const backendUrl = new URL(buildBackendUrl(`/posts/${postId}/comments`))
    backendUrl.search = url.search

    const backendResponse = await fetch(backendUrl.toString(), {
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: 'no-store',
    })

    const json = await backendResponse.json().catch(() => null)
    return NextResponse.json(json ?? { success: false }, { status: backendResponse.status })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Unable to reach backend API.' },
      { status: 502 }
    )
  }
}

export async function POST(request: Request, context: { params: Promise<Params> }) {
  const auth = await requireToken()
  if ('response' in auth) return auth.response

  const { postId } = await context.params
  const body = await request.json().catch(() => null)

  try {
    const backendResponse = await fetch(buildBackendUrl(`/posts/${postId}/comments`), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`,
      },
      body: JSON.stringify(body ?? {}),
      cache: 'no-store',
    })

    const json = await backendResponse.json().catch(() => null)
    return NextResponse.json(json ?? { success: false }, { status: backendResponse.status })
  } catch {
    return NextResponse.json(
      { success: false, message: 'Unable to reach backend API.' },
      { status: 502 }
    )
  }
}

