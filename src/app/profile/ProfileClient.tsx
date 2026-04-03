'use client'

import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type MeUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  profileImageUrl?: string | null
  postCount?: number
}

export default function ProfileClient() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [imageSaving, setImageSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [me, setMe] = useState<MeUser | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [posts, setPosts] = useState<
    Array<{ id: string; text: string; visibility: 'PUBLIC' | 'PRIVATE'; createdAt: string }>
  >([])

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      const res = await fetch('/api/users/me', { cache: 'no-store' })
      if (res.status === 401) {
        router.replace('/login?reason=auth&next=/profile')
        return
      }
      if (!res.ok) {
        setLoading(false)
        setError('Failed to load profile.')
        return
      }
      const json = await res.json().catch(() => null)
      const user = (json?.data ?? null) as MeUser | null
      setMe(user)
      setFirstName(user?.firstName ?? '')
      setLastName(user?.lastName ?? '')
      setEmail(user?.email ?? '')

      if (user?.id) {
        const postsRes = await fetch(`/api/users/${user.id}/posts?limit=20`, { cache: 'no-store' })
        if (postsRes.status === 401) {
          router.replace('/login?reason=auth&next=/profile')
          return
        }
        const postsJson = await postsRes.json().catch(() => null)
        setPosts((postsJson?.data ?? []) as any)
      }

      setLoading(false)
    })()
  }, [])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const res = await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, email }),
    })

    if (res.status === 401) {
      router.replace('/login?reason=auth&next=/profile')
      return
    }

    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setSaving(false)
      setError(json?.message ?? 'Failed to update profile.')
      return
    }

    const json = await res.json().catch(() => null)
    const user = (json?.data ?? null) as MeUser | null
    setMe(user)
    setSaving(false)
  }

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('File read failed'))
      reader.readAsDataURL(file)
    })

  const onSelectImage = async (file: File | null) => {
    if (!file) return

    setImageSaving(true)
    setError(null)

    try {
      const dataUrl = await readFileAsDataUrl(file)

      const res = await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: {
            contentBase64: dataUrl,
            mimeType: file.type || 'image/png',
            originalName: file.name,
          },
        }),
      })

      if (res.status === 401) {
        router.replace('/login?reason=auth&next=/profile')
        return
      }

      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setError(json?.message ?? 'Failed to upload profile image.')
        return
      }

      const json = await res.json().catch(() => null)
      const user = (json?.data ?? null) as MeUser | null
      setMe(user)
    } finally {
      setImageSaving(false)
    }
  }

  const onLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    try {
      window.localStorage.clear()
      window.sessionStorage.clear()
    } catch {
      // ignore
    }
    router.replace('/login?loggedOut=1')
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-12 col-md-8 col-lg-6">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h3 className="m-0">My profile</h3>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => router.push('/feed')}
              >
                Back to feed
              </button>
              <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => void onLogout()}>
                Log out
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-body">
              {loading ? (
                <div className="d-flex align-items-center">
                  <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                  Loading...
                </div>
              ) : (
                <>
                  {error ? <div className="alert alert-danger">{error}</div> : null}

                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <div className="text-muted small">
                      {me?.postCount !== undefined ? `${me.postCount} posts` : ''}
                    </div>
                    <div>
                      <label className="btn btn-outline-primary btn-sm mb-0">
                        {imageSaving ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                            Uploading...
                          </>
                        ) : (
                          'Update photo'
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="d-none"
                          onChange={(e) => void onSelectImage(e.target.files?.[0] ?? null)}
                          disabled={imageSaving}
                        />
                      </label>
                    </div>
                  </div>

                  <form onSubmit={onSubmit}>
                    <div className="mb-3">
                      <label className="form-label">First name</label>
                      <input
                        className="form-control"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Last name</label>
                      <input
                        className="form-control"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Email</label>
                      <input
                        className="form-control"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="d-flex align-items-center justify-content-between">
                      <div className="text-muted small">{me ? `User ID: ${me.id}` : ''}</div>
                      <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm me-2"
                              role="status"
                              aria-hidden="true"
                            />
                            Saving...
                          </>
                        ) : (
                          'Save changes'
                        )}
                      </button>
                    </div>
                  </form>

                  <hr className="my-4" />
                  <h5 className="mb-3">My posts</h5>
                  <div className="d-grid gap-2">
                    {posts.map((post) => (
                      <div className="card" key={post.id}>
                        <div className="card-body">
                          <div className="text-muted small">
                            {new Date(post.createdAt).toLocaleString()} •{' '}
                            {post.visibility === 'PRIVATE' ? 'Private' : 'Public'}
                          </div>
                          <div className="mt-2">{post.text}</div>
                        </div>
                      </div>
                    ))}
                    {!posts.length ? <div className="text-muted">No posts yet.</div> : null}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
