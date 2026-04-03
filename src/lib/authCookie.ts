import { cookies } from 'next/headers'

export const AUTH_COOKIE_NAME = 'access_token'

export const getAccessToken = async (): Promise<string | null> => {
  const store = await cookies()
  return store.get(AUTH_COOKIE_NAME)?.value ?? null
}

export const setAccessToken = async (token: string): Promise<void> => {
  const store = await cookies()
  store.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
}

export const clearAccessToken = async (): Promise<void> => {
  const store = await cookies()
  store.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}

