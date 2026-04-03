'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

type PublicUser = {
  id: string
  firstName: string
  lastName: string
  profileImageUrl: string | null
  createdAt: string
  postCount: number
}

type FeedPost = {
  id: string
  text: string
  imageUrl: string | null
  visibility: 'PUBLIC' | 'PRIVATE'
  likeCount: number
  commentCount: number
  createdAt: string
  author: { id: string; firstName: string; lastName: string }
  likedByMe: boolean
}

const normalizeBackendImageUrl = (backendOrigin: string, imageUrl: string | null): string | null => {
  if (!imageUrl) return null
  if (!imageUrl.startsWith('/')) return imageUrl
  return `${backendOrigin}${imageUrl}`
}

const timeAgo = (isoDate: string): string => {
  const createdAt = new Date(isoDate).getTime()
  const diffMs = Date.now() - createdAt
  const minutes = Math.floor(diffMs / 60000)
  if (!Number.isFinite(minutes) || minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

const toInitials = (fullName: string) =>
  fullName
    .split(' ')
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

export default function UserProfileClient({ backendOrigin }: { backendOrigin: string }) {
  const router = useRouter()
  const params = useParams<{ userId: string }>()
  const userId = params.userId

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<PublicUser | null>(null)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [meId, setMeId] = useState<string | null>(null)

  const isMe = useMemo(() => (meId ? meId === userId : false), [meId, userId])

  const load = async () => {
    setLoading(true)
    setError(null)

    const [meRes, userRes, postsRes] = await Promise.all([
      fetch('/api/users/me', { cache: 'no-store' }),
      fetch(`/api/users/${userId}`, { cache: 'no-store' }),
      fetch(`/api/users/${userId}/posts?limit=20`, { cache: 'no-store' }),
    ])

    if (meRes.status === 401 || userRes.status === 401 || postsRes.status === 401) {
      router.replace(`/login?reason=auth&next=/u/${encodeURIComponent(userId)}`)
      return
    }

    if (meRes.ok) {
      const meJson = await meRes.json().catch(() => null)
      setMeId(String(meJson?.data?.id ?? ''))
    }

    if (!userRes.ok) {
      setLoading(false)
      setError('User not found.')
      return
    }

    const userJson = await userRes.json().catch(() => null)
    setUser((userJson?.data ?? null) as PublicUser | null)

    const postsJson = await postsRes.json().catch(() => null)
    setPosts(((postsJson?.data ?? []) as FeedPost[]) ?? [])

    setLoading(false)
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  // Simple edit post modal (same backend API as feed)
  const [editing, setEditing] = useState<FeedPost | null>(null)
  const [editText, setEditText] = useState('')
  const [editVisibility, setEditVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const openEdit = (post: FeedPost) => {
    setEditing(post)
    setEditText(post.text)
    setEditVisibility(post.visibility)
    setSaveError(null)
  }

  const onSaveEdit = async (event: FormEvent) => {
    event.preventDefault()
    if (!editing) return

    setSaving(true)
    setSaveError(null)

    const res = await fetch(`/api/posts/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: editText.trim(), visibility: editVisibility }),
    })

    if (res.status === 401) {
      router.replace(`/login?reason=auth&next=/u/${encodeURIComponent(userId)}`)
      return
    }

    if (!res.ok) {
      const json = await res.json().catch(() => null)
      setSaving(false)
      setSaveError(json?.message ?? 'Failed to update post.')
      return
    }

    setSaving(false)
    setEditing(null)
    await load()
  }

  const displayName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || 'User'
  const avatarUrl = user?.profileImageUrl ? normalizeBackendImageUrl(backendOrigin, user.profileImageUrl) : null

  return (
    <div className="container py-4">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="rounded-circle border"
              style={{ width: 56, height: 56, objectFit: 'cover' }}
            />
          ) : (
            <div
              className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center"
              style={{ width: 56, height: 56, fontWeight: 600 }}
              title={displayName}
            >
              {toInitials(displayName) || 'U'}
            </div>
          )}
          <div>
            <h4 className="m-0">{displayName}</h4>
            <div className="text-muted small">
              {user ? `${user.postCount} posts • joined ${new Date(user.createdAt).toDateString()}` : ''}
            </div>
          </div>
        </div>

        <div className="d-flex gap-2">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => router.push('/feed')}>
            Back
          </button>
          {isMe ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => router.push('/profile')}>
              Edit profile
            </button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="d-flex align-items-center">
          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
          Loading...
        </div>
      ) : error ? (
        <div className="alert alert-danger">{error}</div>
      ) : (
        <>
          <div className="row g-3">
            {posts.map((post) => (
              <div className="col-12" key={post.id}>
                <div className="card">
                  <div className="card-body">
                    <div className="d-flex justify-content-between">
                      <div className="text-muted small">
                        {timeAgo(post.createdAt)} • {post.visibility === 'PRIVATE' ? 'Private' : 'Public'}
                      </div>
                  {isMe ? (
                    <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => openEdit(post)}>
                      Edit post
                    </button>
                  ) : null}
                    </div>
                    <div className="mt-2">{post.text}</div>
                    {post.imageUrl ? (
                      <div className="mt-3">
                        <img
                          src={normalizeBackendImageUrl(backendOrigin, post.imageUrl) ?? ''}
                          alt="Post image"
                          className="img-fluid rounded"
                          style={{ width: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    ) : null}
                    <div className="mt-3 d-flex gap-3 text-muted small">
                      <span>{post.likeCount} likes</span>
                      <span>{post.commentCount} comments</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {!posts.length ? <div className="text-muted">No posts yet.</div> : null}
          </div>

          {editing ? (
            <div className="modal d-block" tabIndex={-1} role="dialog">
              <div className="modal-dialog modal-dialog-centered" role="document">
                <div className="modal-content">
                  <div className="modal-header">
                    <h5 className="modal-title">Edit post</h5>
                    <button type="button" className="btn-close" aria-label="Close" onClick={() => setEditing(null)} />
                  </div>
                  <form onSubmit={onSaveEdit}>
                    <div className="modal-body">
                      {saveError ? <div className="alert alert-danger">{saveError}</div> : null}
                      <div className="mb-3">
                        <label className="form-label">Text</label>
                        <textarea className="form-control" rows={4} value={editText} onChange={(e) => setEditText(e.target.value)} />
                      </div>
                      <div className="mb-3">
                        <label className="form-label">Visibility</label>
                        <select className="form-select" value={editVisibility} onChange={(e) => setEditVisibility(e.target.value === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC')}>
                          <option value="PUBLIC">Public</option>
                          <option value="PRIVATE">Private</option>
                        </select>
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setEditing(null)} disabled={saving}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                            Saving...
                          </>
                        ) : (
                          'Save'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
