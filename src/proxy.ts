import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value
  const { pathname } = request.nextUrl
  const authReason = request.nextUrl.searchParams.get('reason')

  const isAuthPage = pathname === '/login' || pathname === '/register'
  const isProtected = pathname.startsWith('/feed')

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuthPage && token && authReason !== 'auth') {
    return NextResponse.redirect(new URL('/feed', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/feed/:path*', '/login', '/register'],
}
