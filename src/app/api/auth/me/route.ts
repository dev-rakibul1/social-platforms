import { NextResponse } from 'next/server'
import { buildBackendUrl } from '@/lib/backend'
import { getAccessToken } from '@/lib/authCookie'

export async function GET() {
  const token = await getAccessToken()
  if (!token) {
    return NextResponse.json({ success: false }, { status: 401 })
  }

  const backendResponse = await fetch(buildBackendUrl('/auth/me'), {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  const json = await backendResponse.json().catch(() => null)

  return NextResponse.json(json ?? { success: false }, {
    status: backendResponse.status,
  })
}

