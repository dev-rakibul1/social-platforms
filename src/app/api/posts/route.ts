import { NextResponse } from 'next/server'
import { buildBackendUrl } from '@/lib/backend'
import { getAccessToken } from '@/lib/authCookie'

export async function GET(request: Request) {
  const token = await getAccessToken()
  if (!token) return NextResponse.json({ success: false }, { status: 401 })

  const url = new URL(request.url)
  const backendUrl = new URL(buildBackendUrl('/posts'))
  backendUrl.search = url.search

  const backendResponse = await fetch(backendUrl.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  const json = await backendResponse.json().catch(() => null)
  return NextResponse.json(json ?? { success: false }, { status: backendResponse.status })
}

export async function POST(request: Request) {
  const token = await getAccessToken()
  if (!token) return NextResponse.json({ success: false }, { status: 401 })

  const body = await request.json().catch(() => null)

  const backendResponse = await fetch(buildBackendUrl('/posts'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body ?? {}),
    cache: 'no-store',
  })

  const json = await backendResponse.json().catch(() => null)
  return NextResponse.json(json ?? { success: false }, { status: backendResponse.status })
}

