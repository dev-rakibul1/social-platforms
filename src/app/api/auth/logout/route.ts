import { NextResponse } from 'next/server'
import { clearAccessToken } from '@/lib/authCookie'

export async function POST() {
  await clearAccessToken()
  return NextResponse.json({ success: true })
}

