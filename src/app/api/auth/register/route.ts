import { NextResponse } from 'next/server'
import { buildBackendUrl } from '@/lib/backend'
import { setAccessToken } from '@/lib/authCookie'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)

  try {
    const backendResponse = await fetch(buildBackendUrl('/auth/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      cache: 'no-store',
    })

    const json = await backendResponse.json().catch(() => null)

    if (!backendResponse.ok) {
      return NextResponse.json(json ?? { success: false, message: 'Registration failed.' }, {
        status: backendResponse.status,
      })
    }

    const accessToken = json?.data?.accessToken
    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: 'Backend token missing.' },
        { status: 502 }
      )
    }

    await setAccessToken(String(accessToken))

    return NextResponse.json({
      success: true,
      message: json?.message ?? 'Registration successful.',
      user: json?.data?.user ?? null,
    })
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: 'Unable to reach backend API. Please start the backend and try again.',
      },
      { status: 502 }
    )
  }
}
