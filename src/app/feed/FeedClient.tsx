'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FEED_HTML } from './feedHtml'

type ComposerImage = {
  contentBase64: string
  mimeType: string
  originalName?: string
  previewUrl: string
}

type FeedPost = {
  id: string
  text: string
  imageUrl: string | null
  visibility: 'PUBLIC' | 'PRIVATE'
  likeCount: number
  commentCount: number
  createdAt: string
  author: {
    id: string
    firstName: string
    lastName: string
    profileImageUrl?: string | null
  }
  likedByMe: boolean
  likeUsersPreview?: LikeUser[]
}

type FeedComment = {
  id: string
  postId: string
  parentId: string | null
  text: string
  likeCount: number
  replyCount: number
  createdAt: string
  author: {
    id: string
    firstName: string
    lastName: string
    profileImageUrl?: string | null
  }
  likedByMe: boolean
}

type FeedPostPage = {
  items: FeedPost[]
  nextCursor: string | null
}

type FeedCommentPage = {
  items: FeedComment[]
  nextCursor: string | null
}

type MeUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  profileImageUrl: string | null
}

type LikeUser = {
  firstName: string
  lastName: string
}

type ApiErrorMessage = {
  message?: string
  errorMessages?: Array<{ message?: string }>
}

const getErrorMessage = (value: unknown): string => {
  if (!value || typeof value !== 'object') return 'Something went wrong.'

  const data = value as ApiErrorMessage
  if (typeof data.message === 'string' && data.message.trim()) return data.message

  const first = Array.isArray(data.errorMessages) ? data.errorMessages[0] : null
  if (first && typeof first.message === 'string' && first.message.trim()) return first.message

  return 'Something went wrong.'
}

const timeAgo = (isoDate: string): string => {
  const createdAt = new Date(isoDate).getTime()
  const diffMs = Date.now() - createdAt

  if (!Number.isFinite(diffMs) || diffMs < 0) return 'Just now'

  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`

  const days = Math.floor(hours / 24)
  return `${days} ${days === 1 ? 'day' : 'days'} ago`
}

const shortTimeAgo = (isoDate: string): string => {
  const createdAt = new Date(isoDate).getTime()
  const diffMs = Date.now() - createdAt
  if (!Number.isFinite(diffMs) || diffMs < 0) return 'now'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return 'now'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`

  const days = Math.floor(hours / 24)
  return `${days}d`
}

const normalizeBackendImageUrl = (
  backendOrigin: string,
  imageUrl: string | null | undefined
): string | null => {
  if (!imageUrl) return null
  if (!imageUrl.startsWith('/')) return imageUrl
  return `${backendOrigin}${imageUrl}`
}

const parseVisibilityFromText = (
  raw: string
): { text: string; visibility: 'PUBLIC' | 'PRIVATE'; usedCommand: boolean } => {
  const match = raw.match(/^\s*(#private|\/private|#public|\/public)\b[ \t]*/i)
  if (!match) return { text: raw, visibility: 'PUBLIC', usedCommand: false }

  const cmd = String(match[1] ?? '').toLowerCase()
  return {
    text: raw.slice(match[0].length),
    visibility: cmd.includes('private') ? 'PRIVATE' : 'PUBLIC',
    usedCommand: true,
  }
}

const toInitialsAvatarDataUrl = (name: string): string => {
  const initials = name
    .split(' ')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64">
  <rect width="64" height="64" rx="32" fill="#377DFF"/>
  <text x="32" y="38" text-anchor="middle" font-family="Poppins, Arial, sans-serif" font-size="24" fill="#fff" font-weight="600">${initials || 'U'}</text>
</svg>`

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file.'))
    reader.readAsDataURL(file)
  })

export default function FeedClient({ backendOrigin }: { backendOrigin: string }) {
  const router = useRouter()

  useEffect(() => {
    let postTemplate: HTMLElement | null = null
    let selectedImage: ComposerImage | null = null
    let currentMeId: string | null = null
    let composerVisibility: 'PUBLIC' | 'PRIVATE' = 'PUBLIC'
    let nextPostsCursor: string | null = null

    const actionLocks = new WeakMap<Element, boolean>()
    const expandedPostsKey = '_expanded_posts_v2'

    const redirectToLogin = () => {
      window.location.href = '/login?reason=auth&next=/feed'
    }

    const lockAction = (el: Element): boolean => {
      if (actionLocks.get(el)) return false
      actionLocks.set(el, true)
      return true
    }

    const unlockAction = (el: Element) => {
      actionLocks.delete(el)
    }

    const setButtonLoading = (button: HTMLButtonElement, loading: boolean) => {
      button.disabled = loading
      button.classList.toggle('opacity-75', loading)
      if (loading) {
        if (!button.querySelector('[data-spinner="1"]')) {
          const spinner = document.createElement('span')
          spinner.setAttribute('data-spinner', '1')
          spinner.className = 'spinner-border spinner-border-sm ms-2'
          spinner.setAttribute('aria-hidden', 'true')
          button.appendChild(spinner)
        }
      } else {
        button.querySelector('[data-spinner="1"]')?.remove()
      }
    }

    const rememberExpandedPost = (postId: string) => {
      try {
        const raw = window.localStorage.getItem(expandedPostsKey)
        const parsed = raw ? (JSON.parse(raw) as unknown) : []
        const current = new Set(Array.isArray(parsed) ? parsed.map((value) => String(value)) : [])
        current.add(postId)
        window.localStorage.setItem(expandedPostsKey, JSON.stringify(Array.from(current).slice(0, 100)))
      } catch {
        // ignore
      }
    }

    const readExpandedPosts = (): Set<string> => {
      try {
        const raw = window.localStorage.getItem(expandedPostsKey)
        const parsed = raw ? (JSON.parse(raw) as unknown) : []
        return new Set(Array.isArray(parsed) ? parsed.map((value) => String(value)) : [])
      } catch {
        return new Set()
      }
    }

    const ensureAlert = (id: string, className: string, anchorSelector: string) => {
      const anchor = document.querySelector(anchorSelector) as HTMLElement | null
      if (!anchor) return null

      let node = document.querySelector(`#${id}`) as HTMLElement | null
      if (!node) {
        node = document.createElement('div')
        node.id = id
        anchor.insertAdjacentElement('afterend', node)
      }

      node.className = className
      return node
    }

    const setComposerStatus = (type: 'danger' | 'success' | 'info', message: string) => {
      const node = ensureAlert('_composer_status', `alert alert-${type} mt-2 py-2`, '._feed_inner_text_area')
      if (!node) return
      node.textContent = message
    }

    const clearComposerStatus = () => {
      document.querySelector('#_composer_status')?.remove()
    }

    const syncComposerVisibilityControls = () => {
      document
        .querySelectorAll('[data-composer-visibility-select="1"]')
        .forEach((node) => ((node as HTMLSelectElement).value = composerVisibility))
    }

    const setComposerPhotoButtonsActive = (active: boolean) => {
      document
        .querySelectorAll('._feed_inner_text_area_bottom_photo')
        .forEach((node) => node.classList.toggle('_sp_composer_action_active', active))
    }

    const renderComposerImagePreview = () => {
      const card = document.querySelector('#_composer_preview_card') as HTMLElement | null
      const image = document.querySelector('#_composer_preview_image') as HTMLImageElement | null
      const name = document.querySelector('#_composer_preview_name') as HTMLElement | null

      if (!card || !image || !name) return

      if (!selectedImage?.previewUrl) {
        card.classList.add('d-none')
        image.removeAttribute('src')
        name.textContent = ''
        setComposerPhotoButtonsActive(false)
        return
      }

      image.src = selectedImage.previewUrl
      name.textContent = selectedImage.originalName ?? 'Selected image'
      card.classList.remove('d-none')
      setComposerPhotoButtonsActive(true)
    }

    const clearSelectedComposerImage = (fileInput?: HTMLInputElement) => {
      if (selectedImage?.previewUrl) {
        URL.revokeObjectURL(selectedImage.previewUrl)
      }

      selectedImage = null
      if (fileInput) fileInput.value = ''
      renderComposerImagePreview()
    }

    const setFeedStatus = (className: string, html: string) => {
      const node = ensureAlert('_feed_status', className, '._feed_inner_text_area')
      if (!node) return
      node.innerHTML = html
    }

    const clearFeedStatus = () => {
      document.querySelector('#_feed_status')?.remove()
    }

    const ensureLikesModal = () => {
      const existing = document.querySelector('#_likes_modal') as HTMLElement | null
      if (existing) return existing

      const modal = document.createElement('div')
      modal.id = '_likes_modal'
      modal.className = 'modal fade'
      modal.tabIndex = -1
      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Likes</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <ul class="list-group" id="_likes_modal_list"></ul>
              <div class="mt-3 d-grid gap-2">
                <button type="button" class="btn btn-outline-primary btn-sm d-none" id="_likes_modal_more">Load more</button>
                <div class="small text-muted d-none" id="_likes_modal_meta"></div>
              </div>
            </div>
          </div>
        </div>
      `

      document.body.appendChild(modal)
      return modal
    }

    const showLikesModal = () => {
      const modal = ensureLikesModal()
      const bootstrap = (window as Window & {
        bootstrap?: {
          Modal?: {
            getOrCreateInstance: (element: Element) => { show: () => void }
          }
        }
      }).bootstrap

      const Modal = bootstrap?.Modal
      if (Modal) {
        Modal.getOrCreateInstance(modal).show()
        return
      }
    }

    const renderLikesModal = (
      title: string,
      users: LikeUser[],
      metaText?: string,
      onLoadMore?: null | (() => Promise<void>)
    ) => {
      const modal = ensureLikesModal()
      const titleEl = modal.querySelector('.modal-title') as HTMLElement | null
      const listEl = modal.querySelector('#_likes_modal_list') as HTMLElement | null
      const moreBtn = modal.querySelector('#_likes_modal_more') as HTMLButtonElement | null
      const metaEl = modal.querySelector('#_likes_modal_meta') as HTMLElement | null

      if (titleEl) titleEl.textContent = title

      if (listEl) {
        listEl.innerHTML = ''
        if (!users.length) {
          const empty = document.createElement('li')
          empty.className = 'list-group-item'
          empty.textContent = 'No likes yet.'
          listEl.appendChild(empty)
        } else {
          users.forEach((user) => {
            const item = document.createElement('li')
            item.className = 'list-group-item'
            item.textContent = `${user.firstName} ${user.lastName}`.trim()
            listEl.appendChild(item)
          })
        }
      }

      if (metaEl) {
        metaEl.textContent = metaText ?? ''
        metaEl.classList.toggle('d-none', !metaText)
      }

      if (moreBtn) {
        const nextBtn = moreBtn.cloneNode(true) as HTMLButtonElement
        moreBtn.parentNode?.replaceChild(nextBtn, moreBtn)
        nextBtn.id = '_likes_modal_more'

        if (onLoadMore) {
          nextBtn.classList.remove('d-none')
          nextBtn.addEventListener('click', async () => {
            if (!lockAction(nextBtn)) return
            setButtonLoading(nextBtn, true)
            try {
              await onLoadMore()
            } finally {
              setButtonLoading(nextBtn, false)
              unlockAction(nextBtn)
            }
          })
        } else {
          nextBtn.classList.add('d-none')
        }
      }

      showLikesModal()
    }

    const ensureEditPostModal = () => {
      const existing = document.querySelector('#_edit_post_modal') as HTMLElement | null
      if (existing) return existing

      const modal = document.createElement('div')
      modal.className = 'modal fade'
      modal.id = '_edit_post_modal'
      modal.tabIndex = -1
      modal.setAttribute('aria-hidden', 'true')
      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Edit Post</h5>
              <button type="button" class="btn-close" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="alert alert-danger d-none" id="_edit_post_error"></div>
              <div class="mb-3">
                <label class="form-label" for="_edit_post_text">Post text</label>
                <textarea class="form-control" id="_edit_post_text" rows="5" maxlength="2000"></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label" for="_edit_post_visibility">Audience</label>
                <select class="form-select" id="_edit_post_visibility">
                  <option value="PUBLIC">Public</option>
                  <option value="PRIVATE">Private</option>
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Image</label>
                <div class="d-grid gap-2">
                  <img id="_edit_post_image_preview" alt="Post image" class="img-fluid rounded d-none" />
                  <div class="d-flex gap-2 flex-wrap">
                    <button type="button" class="btn btn-outline-primary btn-sm" id="_edit_post_change_image_btn">Change image</button>
                    <button type="button" class="btn btn-outline-danger btn-sm" id="_edit_post_remove_image_btn">Remove image</button>
                  </div>
                </div>
              </div>
              <div class="d-flex justify-content-end">
                <button type="button" class="btn btn-primary" id="_edit_post_save_btn">Save</button>
              </div>
            </div>
          </div>
        </div>
      `

      document.body.appendChild(modal)
      return modal
    }

    const openEditPostModal = async (post: FeedPost, onSaved: () => Promise<void>) => {
      const modalEl = ensureEditPostModal()
      const instance = (window as Window & {
        bootstrap?: {
          Modal?: {
            getOrCreateInstance: (element: Element) => { show: () => void; hide: () => void }
          }
        }
      }).bootstrap?.Modal?.getOrCreateInstance?.(modalEl) ?? null

      const closeBtn = modalEl.querySelector('button.btn-close') as HTMLButtonElement | null
      const errorEl = modalEl.querySelector('#_edit_post_error') as HTMLElement | null
      const textarea = modalEl.querySelector('#_edit_post_text') as HTMLTextAreaElement | null
      const visibility = modalEl.querySelector('#_edit_post_visibility') as HTMLSelectElement | null
      const previewImg = modalEl.querySelector('#_edit_post_image_preview') as HTMLImageElement | null
      const changeBtn = modalEl.querySelector('#_edit_post_change_image_btn') as HTMLButtonElement | null
      const removeBtn = modalEl.querySelector('#_edit_post_remove_image_btn') as HTMLButtonElement | null
      const saveBtn = modalEl.querySelector('#_edit_post_save_btn') as HTMLButtonElement | null

      if (!textarea || !visibility || !saveBtn) return

      const showFallback = () => {
        modalEl.style.display = 'block'
        modalEl.removeAttribute('aria-hidden')
        modalEl.setAttribute('aria-modal', 'true')
        modalEl.setAttribute('role', 'dialog')
        document.body.classList.add('modal-open')

        if (!document.querySelector('#_edit_post_backdrop')) {
          const backdrop = document.createElement('div')
          backdrop.id = '_edit_post_backdrop'
          backdrop.className = 'modal-backdrop fade show'
          document.body.appendChild(backdrop)
        }

        modalEl.classList.remove('show')
        requestAnimationFrame(() => modalEl.classList.add('show'))
      }

      const cleanupFileInput = () => {
        try {
          fileInput.remove()
        } catch {
          // ignore
        }
      }

      const hideFallback = () => {
        modalEl.classList.remove('show')
        window.setTimeout(() => {
          modalEl.style.display = 'none'
          modalEl.setAttribute('aria-hidden', 'true')
          modalEl.removeAttribute('aria-modal')
          modalEl.removeAttribute('role')
          document.body.classList.remove('modal-open')
          document.querySelector('#_edit_post_backdrop')?.remove()
          cleanupFileInput()
        }, 150)
      }

      const showModal = () => {
        if (instance?.show) instance.show()
        else showFallback()
      }

      const hideModal = () => {
        if (instance?.hide) instance.hide()
        else hideFallback()
      }

      if (closeBtn) {
        const cloned = closeBtn.cloneNode(true) as HTMLButtonElement
        closeBtn.parentNode?.replaceChild(cloned, closeBtn)
        cloned.addEventListener('click', () => hideModal())
      }

      if (errorEl) {
        errorEl.classList.add('d-none')
        errorEl.textContent = ''
      }

      textarea.value = post.text
      visibility.value = post.visibility

      let saveBtnLive = saveBtn
      {
        const cloned = saveBtnLive.cloneNode(true) as HTMLButtonElement
        saveBtnLive.parentNode?.replaceChild(cloned, saveBtnLive)
        cloned.id = '_edit_post_save_btn'
        saveBtnLive = cloned
      }

      let changeBtnLive: HTMLButtonElement | null = changeBtn
      if (changeBtnLive) {
        const cloned = changeBtnLive.cloneNode(true) as HTMLButtonElement
        changeBtnLive.parentNode?.replaceChild(cloned, changeBtnLive)
        cloned.id = '_edit_post_change_image_btn'
        changeBtnLive = cloned
      }

      let removeBtnLive: HTMLButtonElement | null = removeBtn
      if (removeBtnLive) {
        const cloned = removeBtnLive.cloneNode(true) as HTMLButtonElement
        removeBtnLive.parentNode?.replaceChild(cloned, removeBtnLive)
        cloned.id = '_edit_post_remove_image_btn'
        removeBtnLive = cloned
      }

      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = 'image/*'
      fileInput.style.display = 'none'
      document.body.appendChild(fileInput)

      modalEl.addEventListener('hidden.bs.modal', cleanupFileInput, { once: true })

      let selectedEditImage:
        | { contentBase64: string; mimeType: string; originalName?: string }
        | null = null
      let removeCurrentImage = false

      const setError = (message: string | null) => {
        if (!errorEl) return
        if (!message) {
          errorEl.classList.add('d-none')
          errorEl.textContent = ''
          return
        }
        errorEl.textContent = message
        errorEl.classList.remove('d-none')
      }

      const setPreview = (src: string | null) => {
        if (!previewImg) return
        if (!src) {
          previewImg.src = ''
          previewImg.classList.add('d-none')
          if (removeBtnLive) removeBtnLive.disabled = true
          return
        }
        previewImg.src = src
        previewImg.classList.remove('d-none')
        if (removeBtnLive) removeBtnLive.disabled = false
      }

      setPreview(normalizeBackendImageUrl(backendOrigin, post.imageUrl))

      if (changeBtnLive) {
        changeBtnLive.addEventListener('click', () => fileInput.click())
      }

      if (removeBtnLive) {
        removeBtnLive.addEventListener('click', () => {
          removeCurrentImage = true
          selectedEditImage = null
          fileInput.value = ''
          setPreview(null)
        })
      }

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0] ?? null
        if (!file) return

        try {
          const contentBase64 = await readFileAsBase64(file)
          selectedEditImage = {
            contentBase64,
            mimeType: file.type || 'image/png',
            originalName: file.name,
          }
          removeCurrentImage = false
          setPreview(`data:${selectedEditImage.mimeType};base64,${selectedEditImage.contentBase64}`)
        } catch {
          setError('Unable to read the selected image.')
        }
      })

      saveBtnLive.addEventListener('click', async () => {
        const nextText = textarea.value.trim()
        if (!nextText) {
          setError('Post text is required.')
          return
        }

        setError(null)
        setButtonLoading(saveBtnLive, true)

        try {
          const payload: {
            text: string
            visibility: 'PUBLIC' | 'PRIVATE'
            removeImage?: boolean
            image?: { contentBase64: string; mimeType: string; originalName?: string }
          } = {
            text: nextText,
            visibility: visibility.value === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
          }

          if (removeCurrentImage) payload.removeImage = true
          if (selectedEditImage) payload.image = selectedEditImage

          const { response, json } = await fetchJson(`/api/posts/${post.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

          if (!response.ok) {
            setError(getErrorMessage(json))
            return
          }

          await onSaved()
          hideModal()
        } finally {
          setButtonLoading(saveBtnLive, false)
        }
      })

      showModal()
      textarea.focus()
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
    }

    const updateLikePreview = (postEl: HTMLElement, users: LikeUser[]) => {
      const imgs = Array.from(
        postEl.querySelectorAll('._feed_inner_timeline_total_reacts_image img')
      ) as HTMLImageElement[]

      imgs.forEach((img, index) => {
        const user = users[index]
        if (!user) {
          img.style.display = 'none'
          return
        }

        const fullName = `${user.firstName} ${user.lastName}`.trim() || 'User'
        img.style.display = ''
        img.src = toInitialsAvatarDataUrl(fullName)
        img.alt = fullName
        img.title = fullName
      })
    }

    const fetchJson = async (input: string, init?: RequestInit) => {
      const response = await fetch(input, { cache: 'no-store', ...init })
      const json = await response.json().catch(() => null)

      if (response.status === 401) {
        redirectToLogin()
        throw new Error('Unauthorized')
      }

      return { response, json }
    }

    const loadPostLikesPage = async (postId: string, cursor?: string) => {
      const url = new URL(`/api/posts/${postId}/likes`, window.location.origin)
      url.searchParams.set('limit', '20')
      if (cursor) url.searchParams.set('cursor', cursor)

      const { response, json } = await fetchJson(url.toString())
      if (!response.ok) throw new Error(getErrorMessage(json))

      return {
        users: ((json?.data ?? []) as Array<{ user: LikeUser }>).map((item) => item.user),
        nextCursor: (json?.meta?.nextCursor as string | null) ?? null,
      }
    }

    const loadCommentLikesPage = async (commentId: string, cursor?: string) => {
      const url = new URL(`/api/comments/${commentId}/likes`, window.location.origin)
      url.searchParams.set('limit', '20')
      if (cursor) url.searchParams.set('cursor', cursor)

      const { response, json } = await fetchJson(url.toString())
      if (!response.ok) throw new Error(getErrorMessage(json))

      return {
        users: ((json?.data ?? []) as Array<{ user: LikeUser }>).map((item) => item.user),
        nextCursor: (json?.meta?.nextCursor as string | null) ?? null,
      }
    }

    const openLikesList = async (
      title: string,
      totalCount: number,
      loader: (cursor?: string) => Promise<{ users: LikeUser[]; nextCursor: string | null }>
    ) => {
      let users: LikeUser[] = []
      let nextCursor: string | null = null

      const load = async (cursor?: string) => {
        const page = await loader(cursor)
        users = cursor ? users.concat(page.users) : page.users
        nextCursor = page.nextCursor

        const meta = `Showing ${Math.min(users.length, totalCount)} of ${totalCount}`
        renderLikesModal(title, users, meta, nextCursor ? () => load(nextCursor ?? undefined) : null)
      }

      await load()
    }

    const loadCommentsPage = async (
      postId: string,
      options?: { parentId?: string; cursor?: string; limit?: number }
    ): Promise<FeedCommentPage> => {
      const url = new URL(`/api/posts/${postId}/comments`, window.location.origin)
      url.searchParams.set('limit', String(options?.limit ?? 5))
      if (options?.parentId) url.searchParams.set('parentId', options.parentId)
      if (options?.cursor) url.searchParams.set('cursor', options.cursor)

      const { response, json } = await fetchJson(url.toString())
      if (!response.ok) throw new Error(getErrorMessage(json))

      return {
        items: (json?.data ?? []) as FeedComment[],
        nextCursor: (json?.meta?.nextCursor as string | null) ?? null,
      }
    }

    const createComment = async (postId: string, payload: { text: string; parentId?: string }) => {
      const { response, json } = await fetchJson(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        setComposerStatus('danger', getErrorMessage(json))
        return false
      }

      return true
    }

    const togglePostLike = async (postId: string, shouldLike: boolean) => {
      const { response, json } = await fetchJson(`/api/posts/${postId}/likes`, {
        method: shouldLike ? 'POST' : 'DELETE',
      })
      if (!response.ok) throw new Error(getErrorMessage(json))
      return json
    }

    const toggleCommentLike = async (commentId: string, shouldLike: boolean) => {
      const { response, json } = await fetchJson(`/api/comments/${commentId}/likes`, {
        method: shouldLike ? 'POST' : 'DELETE',
      })
      if (!response.ok) throw new Error(getErrorMessage(json))
      return json
    }

    const createCommentBoxSubmit = (
      textarea: HTMLTextAreaElement,
      onSubmit: (text: string) => Promise<void>
    ) => {
      const form = textarea.closest('form') as HTMLFormElement | null
      if (form) {
        form.addEventListener('submit', (event) => event.preventDefault())
        Array.from(form.querySelectorAll('button')).forEach((button) => {
          button.setAttribute('type', 'button')
          button.addEventListener('click', async (event) => {
            event.preventDefault()
            const text = textarea.value.trim()
            if (!text) return
            await onSubmit(text)
          })
        })
      }

      textarea.addEventListener('keydown', async (event) => {
        if (event.repeat) return
        if (event.key !== 'Enter' || event.shiftKey) return
        event.preventDefault()

        const text = textarea.value.trim()
        if (!text) return
        await onSubmit(text)
      })
    }

    const createLoadMoreButton = (label: string, className?: string) => {
      const wrapper = document.createElement('div')
      wrapper.className = className ?? '_previous_comment mt-2'

      const button = document.createElement('button')
      button.type = 'button'
      button.className = '_previous_comment_txt'
      button.textContent = label

      wrapper.appendChild(button)
      return { wrapper, button }
    }

    const renderCommentNode = async (
      template: HTMLElement,
      comment: FeedComment,
      postEl: HTMLElement
    ) => {
      const commentEl = template.cloneNode(true) as HTMLElement
      commentEl.style.display = ''
      commentEl.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'))

      if (comment.parentId) {
        commentEl.style.marginLeft = '2.75rem'
        commentEl.classList.add('mt-2')
      }

      const fullName = `${comment.author.firstName} ${comment.author.lastName}`.trim() || 'User'
      const avatarUrl =
        normalizeBackendImageUrl(backendOrigin, comment.author.profileImageUrl) ??
        toInitialsAvatarDataUrl(fullName)

      const avatar = commentEl.querySelector('img._comment_img1') as HTMLImageElement | null
      if (avatar) {
        avatar.src = avatarUrl
        avatar.alt = fullName
      }

      const authorLinks = Array.from(
        commentEl.querySelectorAll('a[href*="profile.html"]')
      ) as HTMLAnchorElement[]
      authorLinks.forEach((link) => {
        link.href = `/u/${comment.author.id}`
      })

      const title = commentEl.querySelector('._comment_name_title') as HTMLElement | null
      if (title) title.textContent = fullName

      const textEl = commentEl.querySelector('._comment_status_text span') as HTMLElement | null
      if (textEl) {
        textEl.textContent = comment.text
        textEl.style.whiteSpace = 'pre-wrap'
        textEl.style.wordBreak = 'break-word'
      }

      const timeEl = commentEl.querySelector('._time_link') as HTMLElement | null
      if (timeEl) timeEl.textContent = comment.parentId ? `· ${shortTimeAgo(comment.createdAt)}` : `.${shortTimeAgo(comment.createdAt)}`

      const totalEl = commentEl.querySelector('span._total') as HTMLElement | null
      if (totalEl) totalEl.textContent = String(comment.likeCount)

      const actionSpans = Array.from(
        commentEl.querySelectorAll('._comment_reply_list li span')
      ) as HTMLSpanElement[]

      const likeAction = actionSpans.find((item) =>
        item.textContent?.trim().toLowerCase().startsWith('like')
      )
      const replyAction = actionSpans.find((item) =>
        item.textContent?.trim().toLowerCase().startsWith('reply')
      )
      const shareAction = actionSpans.find((item) =>
        item.textContent?.trim().toLowerCase().startsWith('share')
      )

      if (shareAction) {
        ;(shareAction.parentElement as HTMLElement | null)?.classList.add('d-none')
      }

      let likedByMe = comment.likedByMe
      if (likeAction) {
        likeAction.style.cursor = 'pointer'
        likeAction.classList.toggle('_feed_reaction_active', likedByMe)
        likeAction.textContent = 'Like'
        likeAction.addEventListener('click', async () => {
          if (!lockAction(likeAction)) return
          try {
            const json = await toggleCommentLike(comment.id, !likedByMe)
            const nextLiked = json?.data?.liked
            const nextCount = json?.data?.likeCount

            if (typeof nextLiked === 'boolean') {
              likedByMe = nextLiked
              likeAction.classList.toggle('_feed_reaction_active', likedByMe)
            }
            if (typeof nextCount === 'number' && totalEl) {
              totalEl.textContent = String(nextCount)
            }
          } finally {
            unlockAction(likeAction)
          }
        })
      }

      if (totalEl) {
        totalEl.style.cursor = 'pointer'
        totalEl.addEventListener('click', async () => {
          if (!lockAction(totalEl)) return
          try {
            await openLikesList('Comment likes', Number(totalEl.textContent ?? comment.likeCount), (cursor) =>
              loadCommentLikesPage(comment.id, cursor)
            )
          } finally {
            unlockAction(totalEl)
          }
        })
      }

      const replyBox = commentEl.querySelector('._feed_inner_comment_box') as HTMLElement | null
      const replyTextarea = commentEl.querySelector('._feed_inner_comment_box textarea._comment_textarea') as HTMLTextAreaElement | null

      if (replyBox) replyBox.style.display = 'none'

      if (comment.parentId) {
        if (replyAction) (replyAction.parentElement as HTMLElement | null)?.classList.add('d-none')
        if (replyBox) replyBox.remove()
      } else if (replyAction && replyBox && replyTextarea) {
        replyAction.style.cursor = 'pointer'
        replyAction.textContent = comment.replyCount > 0 ? `Reply (${comment.replyCount})` : 'Reply'
        replyAction.addEventListener('click', () => {
          replyBox.style.display = replyBox.style.display === 'none' ? '' : 'none'
          if (replyBox.style.display !== 'none') replyTextarea.focus()
        })

        createCommentBoxSubmit(replyTextarea, async (text) => {
          replyTextarea.readOnly = true
          try {
            rememberExpandedPost(comment.postId)
            const ok = await createComment(comment.postId, { text, parentId: comment.id })
            if (!ok) return
            replyTextarea.value = ''
            await renderCommentsIntoPost(postEl, comment.postId)
            const countEl = postEl.querySelector('._feed_inner_timeline_total_reacts_para1 span') as HTMLElement | null
            if (countEl) {
              const current = Number(countEl.textContent ?? '0')
              if (Number.isFinite(current)) countEl.textContent = String(current + 1)
            }
          } finally {
            replyTextarea.readOnly = false
          }
        })
      }

      return commentEl
    }

    const renderCommentsIntoPost = async (postEl: HTMLElement, postId: string) => {
      const commentsRoot = postEl.querySelector('._timline_comment_main') as HTMLElement | null
      if (!commentsRoot) return

      const template = commentsRoot.querySelector('._comment_main')?.cloneNode(true) as HTMLElement | null
      if (!template) return
      template.style.display = ''

      commentsRoot.querySelectorAll('._comment_main, [data-load-more="1"]').forEach((node) => node.remove())
      const previousStatic = commentsRoot.querySelector('._previous_comment') as HTMLElement | null
      if (previousStatic) previousStatic.remove()

      const renderThread = async (
        container: HTMLElement,
        comment: FeedComment,
        addReplyLoadMore = true
      ) => {
        const commentEl = await renderCommentNode(template, comment, postEl)
        container.appendChild(commentEl)

        if (!comment.replyCount) return

        const replyWrap = document.createElement('div')
        replyWrap.className = 'w-100'
        container.appendChild(replyWrap)

        const firstReplies = await loadCommentsPage(postId, {
          parentId: comment.id,
          limit: 5,
        })

        for (const reply of firstReplies.items) {
          const replyEl = await renderCommentNode(template, reply, postEl)
          replyWrap.appendChild(replyEl)
        }

        if (addReplyLoadMore && firstReplies.nextCursor) {
          let nextCursor: string | null = firstReplies.nextCursor
          const { wrapper, button } = createLoadMoreButton('View more replies', '_previous_comment ms-4 mt-2')
          wrapper.setAttribute('data-load-more', '1')
          replyWrap.appendChild(wrapper)

          button.addEventListener('click', async () => {
            if (!nextCursor || !lockAction(button)) return
            setButtonLoading(button, true)
            try {
              const page = await loadCommentsPage(postId, {
                parentId: comment.id,
                limit: 5,
                cursor: nextCursor,
              })

              for (const reply of page.items) {
                const replyEl = await renderCommentNode(template, reply, postEl)
                replyWrap.insertBefore(replyEl, wrapper)
              }

              nextCursor = page.nextCursor
              if (!nextCursor) wrapper.remove()
            } finally {
              setButtonLoading(button, false)
              unlockAction(button)
            }
          })
        }
      }

      const topLevel = await loadCommentsPage(postId, { limit: 5 })
      for (const comment of topLevel.items) {
        await renderThread(commentsRoot, comment)
      }

      if (topLevel.nextCursor) {
        let nextCursor: string | null = topLevel.nextCursor
        const { wrapper, button } = createLoadMoreButton('View more comments', '_previous_comment mt-2')
        wrapper.setAttribute('data-load-more', '1')
        commentsRoot.appendChild(wrapper)

        button.addEventListener('click', async () => {
          if (!nextCursor || !lockAction(button)) return
          setButtonLoading(button, true)
          try {
            const page = await loadCommentsPage(postId, { limit: 5, cursor: nextCursor })
            for (const comment of page.items) {
              await renderThread(commentsRoot, comment)
            }
            nextCursor = page.nextCursor
            if (!nextCursor) wrapper.remove()
          } finally {
            setButtonLoading(button, false)
            unlockAction(button)
          }
        })
      }

      commentsRoot.setAttribute('data-loaded', '1')
    }

    const closePostDropdowns = (except?: HTMLElement | null) => {
      const menus = Array.from(document.querySelectorAll('._feed_timeline_dropdown.show')) as HTMLElement[]

      menus.forEach((menu) => {
        if (except && menu === except) return
        menu.classList.remove('show')
      })
    }

    const bindPostInteractions = async (postEl: HTMLElement, post: FeedPost) => {
      const authorName = `${post.author.firstName} ${post.author.lastName}`.trim() || 'User'
      const authorAvatar =
        normalizeBackendImageUrl(backendOrigin, post.author.profileImageUrl) ??
        toInitialsAvatarDataUrl(authorName)

      postEl.setAttribute('data-post-id', post.id)
      postEl.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'))

      const titleEl = postEl.querySelector('._feed_inner_timeline_post_title') as HTMLElement | null
      if (titleEl) {
        titleEl.textContent = post.text
        titleEl.style.whiteSpace = 'pre-wrap'
        titleEl.style.wordBreak = 'break-word'
      }

      const authorTitle = postEl.querySelector('._feed_inner_timeline_post_box_title') as HTMLElement | null
      if (authorTitle) authorTitle.textContent = authorName

      const authorLinks = Array.from(
        postEl.querySelectorAll('a[href*="profile.html"]')
      ) as HTMLAnchorElement[]
      authorLinks.forEach((link) => {
        link.href = `/u/${post.author.id}`
      })

      const postAvatar = postEl.querySelector('img._post_img') as HTMLImageElement | null
      if (postAvatar) {
        postAvatar.src = authorAvatar
        postAvatar.alt = authorName
      }

      const metaText = postEl.querySelector('._feed_inner_timeline_post_box_para') as HTMLElement | null
      if (metaText && metaText.childNodes.length > 0) {
        metaText.childNodes[0].textContent = `${timeAgo(post.createdAt)} . `
        const visibilityLink = metaText.querySelector('a') as HTMLElement | null
        if (visibilityLink) visibilityLink.textContent = post.visibility === 'PRIVATE' ? 'Private' : 'Public'
      }

      const image = postEl.querySelector('._feed_inner_timeline_image img') as HTMLImageElement | null
      if (image) {
        const imageUrl = normalizeBackendImageUrl(backendOrigin, post.imageUrl)
        if (imageUrl) {
          image.src = imageUrl
          image.style.display = ''
        } else {
          image.style.display = 'none'
        }
      }

      const likeCountEl = postEl.querySelector(
        '._feed_inner_timeline_total_reacts_para'
      ) as HTMLElement | null
      if (likeCountEl) likeCountEl.textContent = String(post.likeCount)

      const commentCountEl = postEl.querySelector(
        '._feed_inner_timeline_total_reacts_para1 span'
      ) as HTMLElement | null
      if (commentCountEl) commentCountEl.textContent = String(post.commentCount)

      const shareEl = postEl.querySelector('._feed_inner_timeline_total_reacts_para2') as HTMLElement | null
      if (shareEl) shareEl.style.display = 'none'

      const dropdown = postEl.querySelector('._feed_inner_timeline_post_box_dropdown') as HTMLElement | null
      const dropdownBtn = dropdown?.querySelector(
        'button._feed_timeline_post_dropdown_link'
      ) as HTMLButtonElement | null
      const dropdownMenu = dropdown?.querySelector('._feed_timeline_dropdown') as HTMLElement | null

      if (dropdown && dropdownBtn && dropdownMenu) {
        const isMyPost = Boolean(currentMeId && currentMeId === post.author.id)
        const dropdownLinks = Array.from(
          dropdownMenu.querySelectorAll('a._feed_timeline_dropdown_link')
        ) as HTMLAnchorElement[]
        const editLink =
          dropdownLinks.find((link) =>
            link.textContent?.trim().toLowerCase().includes('edit post')
          ) ?? null
        const deleteLink =
          dropdownLinks.find((link) =>
            link.textContent?.trim().toLowerCase().includes('delete post')
          ) ?? null

        dropdown.style.display = ''
        dropdownBtn.type = 'button'
        dropdownBtn.style.display = 'inline-flex'

        if (editLink?.parentElement) {
          ;(editLink.parentElement as HTMLElement).style.display = isMyPost ? '' : 'none'
        }

        if (deleteLink?.parentElement) {
          ;(deleteLink.parentElement as HTMLElement).style.display = isMyPost ? '' : 'none'
        }

        dropdownBtn.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()

          const shouldOpen = !dropdownMenu.classList.contains('show')
          closePostDropdowns(shouldOpen ? dropdownMenu : null)
          dropdownMenu.classList.toggle('show', shouldOpen)
        })

        dropdownMenu.addEventListener('click', (event) => {
          event.stopPropagation()
        })

        if (editLink) {
          editLink.addEventListener('click', async (event) => {
            event.preventDefault()
            event.stopPropagation()
            dropdownMenu.classList.remove('show')
            await openEditPostModal(post, async () => {
              await loadPosts()
            })
          })
        }
      }

      const previewUsers = post.likeUsersPreview ?? []
      updateLikePreview(postEl, previewUsers)

      if (likeCountEl) {
        likeCountEl.style.cursor = 'pointer'
        likeCountEl.addEventListener('click', async () => {
          if (!lockAction(likeCountEl)) return
          try {
            await openLikesList('Post likes', Number(likeCountEl.textContent ?? post.likeCount), (cursor) =>
              loadPostLikesPage(post.id, cursor)
            )
          } finally {
            unlockAction(likeCountEl)
          }
        })
      }

      const likeBtn = postEl.querySelector('button._feed_inner_timeline_reaction_emoji') as HTMLButtonElement | null
      if (likeBtn) {
        let likedByMe = post.likedByMe
        likeBtn.classList.toggle('_feed_reaction_active', likedByMe)
        likeBtn.addEventListener('click', async () => {
          if (!lockAction(likeBtn)) return
          setButtonLoading(likeBtn, true)
          try {
            const json = await togglePostLike(post.id, !likedByMe)
            const nextLiked = json?.data?.liked
            const nextCount = json?.data?.likeCount

            if (typeof nextLiked === 'boolean') {
              likedByMe = nextLiked
              likeBtn.classList.toggle('_feed_reaction_active', likedByMe)
            }

            if (typeof nextCount === 'number' && likeCountEl) {
              likeCountEl.textContent = String(nextCount)
            }

            const previewPage = await loadPostLikesPage(post.id)
            updateLikePreview(postEl, previewPage.users)
          } finally {
            setButtonLoading(likeBtn, false)
            unlockAction(likeBtn)
          }
        })
      }

      const commentsRoot = postEl.querySelector('._timline_comment_main') as HTMLElement | null
      if (commentsRoot) {
        commentsRoot.querySelector('._comment_main')?.setAttribute('style', 'display:none')
        ;(commentsRoot.querySelector('._previous_comment') as HTMLElement | null)?.setAttribute(
          'style',
          'display:none'
        )
        commentsRoot.setAttribute('data-loaded', '0')
      }

      const postCommentTextarea = postEl.querySelector(
        '._feed_inner_timeline_cooment_area textarea._comment_textarea'
      ) as HTMLTextAreaElement | null

      if (postCommentTextarea) {
        createCommentBoxSubmit(postCommentTextarea, async (text) => {
          postCommentTextarea.readOnly = true
          try {
            rememberExpandedPost(post.id)
            const ok = await createComment(post.id, { text })
            if (!ok) return
            postCommentTextarea.value = ''
            await renderCommentsIntoPost(postEl, post.id)
            if (commentCountEl) {
              const current = Number(commentCountEl.textContent ?? '0')
              if (Number.isFinite(current)) commentCountEl.textContent = String(current + 1)
            }
          } finally {
            postCommentTextarea.readOnly = false
          }
        })
      }

      const commentBtn = postEl.querySelector(
        'button._feed_inner_timeline_reaction_comment'
      ) as HTMLButtonElement | null

      if (commentBtn) {
        commentBtn.addEventListener('click', async () => {
          if (commentsRoot?.getAttribute('data-loaded') === '1') return
          rememberExpandedPost(post.id)
          await renderCommentsIntoPost(postEl, post.id)
        })
      }

      if (readExpandedPosts().has(post.id)) {
        await renderCommentsIntoPost(postEl, post.id)
      }
    }

    const renderPosts = async (posts: FeedPost[], mode: 'reset' | 'append' = 'reset') => {
      const composer = document.querySelector('._feed_inner_text_area') as HTMLElement | null
      if (!composer) return

      const currentPosts = Array.from(
        document.querySelectorAll('._feed_inner_timeline_post_area')
      ) as HTMLElement[]

      if (!postTemplate) {
        const source = currentPosts[0]
        if (!source) return
        postTemplate = source.cloneNode(true) as HTMLElement
      }

      if (mode === 'reset') {
        currentPosts.forEach((postNode) => postNode.remove())
      }

      let insertAfter: Element = composer
      if (mode === 'append') {
        const postsOnPage = Array.from(
          document.querySelectorAll('._feed_inner_timeline_post_area')
        ) as HTMLElement[]
        insertAfter = postsOnPage[postsOnPage.length - 1] ?? composer
      }

      for (const post of posts) {
        const postEl = postTemplate.cloneNode(true) as HTMLElement
        postEl.style.display = ''
        await bindPostInteractions(postEl, post)
        insertAfter.insertAdjacentElement('afterend', postEl)
        insertAfter = postEl
      }
    }

    const updateLoadMorePostsControl = () => {
      document.querySelector('#_feed_load_more_wrap')?.remove()
      if (!nextPostsCursor) return

      const composer = document.querySelector('._feed_inner_text_area') as HTMLElement | null
      if (!composer) return

      const posts = Array.from(document.querySelectorAll('._feed_inner_timeline_post_area')) as HTMLElement[]
      const anchor = posts[posts.length - 1] ?? composer

      const wrapper = document.createElement('div')
      wrapper.id = '_feed_load_more_wrap'
      wrapper.className = 'text-center mt-3 mb-4'

      const button = document.createElement('button')
      button.type = 'button'
      button.className = '_previous_comment_txt'
      button.textContent = 'Load more posts'
      wrapper.appendChild(button)

      button.addEventListener('click', async () => {
        if (!nextPostsCursor || !lockAction(button)) return
        setButtonLoading(button, true)
        try {
          const page = await loadPostsPage(nextPostsCursor)
          nextPostsCursor = page.nextCursor
          await renderPosts(page.items, 'append')
          updateLoadMorePostsControl()
        } catch (error) {
          setFeedStatus('alert alert-danger mt-3', String((error as Error)?.message ?? 'Failed to load more posts.'))
        } finally {
          setButtonLoading(button, false)
          unlockAction(button)
        }
      })

      anchor.insertAdjacentElement('afterend', wrapper)
    }

    const loadPostsPage = async (cursor?: string): Promise<FeedPostPage> => {
      const url = new URL('/api/posts', window.location.origin)
      url.searchParams.set('limit', '20')
      if (cursor) url.searchParams.set('cursor', cursor)

      const { response, json } = await fetchJson(url.toString())
      if (!response.ok) throw new Error(getErrorMessage(json))

      return {
        items: (json?.data ?? []) as FeedPost[],
        nextCursor: (json?.meta?.nextCursor as string | null) ?? null,
      }
    }

    const loadPosts = async () => {
      setFeedStatus(
        'd-flex align-items-center py-3',
        '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Loading posts...'
      )

      try {
        const page = await loadPostsPage()
        nextPostsCursor = page.nextCursor
        clearFeedStatus()

        if (!page.items.length) {
          setFeedStatus('alert alert-secondary mt-3', 'No posts yet.')
        }

        await renderPosts(page.items, 'reset')
        updateLoadMorePostsControl()
      } catch (error) {
        setFeedStatus(
          'alert alert-danger mt-3',
          String((error as Error)?.message ?? 'Failed to load posts. Please try again.')
        )
      }
    }

    const ensureComposerControls = () => {
      const slots = Array.from(
        document.querySelectorAll('[data-composer-audience-slot="1"]')
      ) as HTMLElement[]

      slots.forEach((slot) => {
        if (slot.querySelector('[data-composer-visibility="1"]')) return

        const audienceWrap = document.createElement('div')
        audienceWrap.setAttribute('data-composer-visibility', '1')
        audienceWrap.className = '_sp_composer_audience'

        const label = document.createElement('span')
        label.className = '_sp_composer_audience_label'
        label.textContent = 'Audience'

        const select = document.createElement('select')
        select.className = 'form-select form-select-sm _sp_composer_audience_select'
        select.setAttribute('data-composer-visibility-select', '1')
        select.setAttribute('aria-label', 'Choose post audience')
        select.innerHTML = `
          <option value="PUBLIC">Public</option>
          <option value="PRIVATE">Private</option>
        `
        select.value = composerVisibility
        select.addEventListener('change', () => {
          composerVisibility = select.value === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC'
          syncComposerVisibilityControls()
        })

        audienceWrap.append(label, select)
        slot.appendChild(audienceWrap)
      })

      syncComposerVisibilityControls()
    }

    const bindComposer = () => {
      ensureComposerControls()

      const textarea = document.querySelector('#floatingTextarea') as HTMLTextAreaElement | null
      if (!textarea) return

      const photoButtons = Array.from(
        document.querySelectorAll('._feed_inner_text_area_bottom_photo ._feed_inner_text_area_bottom_photo_link')
      ) as HTMLButtonElement[]
      const postButtons = Array.from(
        document.querySelectorAll('._feed_inner_text_area_btn_link')
      ) as HTMLButtonElement[]
      const replaceButton = document.querySelector('#_composer_replace_btn') as HTMLButtonElement | null
      const removeButton = document.querySelector('#_composer_remove_btn') as HTMLButtonElement | null

      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = 'image/*'
      fileInput.style.display = 'none'
      document.body.appendChild(fileInput)

      photoButtons.forEach((button) => {
        button.addEventListener('click', () => {
          clearComposerStatus()
          fileInput.click()
        })
      })

      replaceButton?.addEventListener('click', () => fileInput.click())
      removeButton?.addEventListener('click', () => {
        clearSelectedComposerImage(fileInput)
        clearComposerStatus()
      })

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0]
        if (!file) return

        clearComposerStatus()
        const previewUrl = URL.createObjectURL(file)

        try {
          clearSelectedComposerImage()
          selectedImage = {
            contentBase64: await readFileAsBase64(file),
            mimeType: file.type || 'image/png',
            originalName: file.name,
            previewUrl,
          }
          renderComposerImagePreview()
        } catch {
          URL.revokeObjectURL(previewUrl)
          clearSelectedComposerImage(fileInput)
          setComposerStatus('danger', 'Unable to read the selected image.')
        }
      })

      postButtons.forEach((button) => {
        button.addEventListener('click', async () => {
          if (!lockAction(button)) return

          const parsed = parseVisibilityFromText(textarea.value)
          const text = parsed.text.trim()
          const visibility = parsed.usedCommand ? parsed.visibility : composerVisibility

          if (!text) {
            setComposerStatus(
              'danger',
              selectedImage
                ? 'Write something before posting the selected image.'
                : 'Write something to create a post.'
            )
            unlockAction(button)
            return
          }

          setButtonLoading(button, true)
          clearComposerStatus()

          try {
            const { response, json } = await fetchJson('/api/posts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text,
                visibility,
                image: selectedImage
                  ? {
                      contentBase64: selectedImage.contentBase64,
                      mimeType: selectedImage.mimeType,
                      originalName: selectedImage.originalName,
                    }
                  : undefined,
              }),
            })

            if (!response.ok) {
              setComposerStatus('danger', getErrorMessage(json))
              return
            }

            textarea.value = ''
            clearSelectedComposerImage(fileInput)
            setComposerStatus('success', `Post created as ${visibility.toLowerCase()}.`)
            await loadPosts()
          } finally {
            setButtonLoading(button, false)
            unlockAction(button)
          }
        })
      })

      renderComposerImagePreview()

      return () => {
        clearSelectedComposerImage()
        fileInput.remove()
      }
    }

    const hydrateHeader = async () => {
      const { response, json } = await fetchJson('/api/users/me')
      if (!response.ok) return

      const me = (json?.data ?? null) as MeUser | null
      if (!me) return

      currentMeId = me.id
      const fullName = `${me.firstName} ${me.lastName}`.trim() || 'User'
      const avatar = normalizeBackendImageUrl(backendOrigin, me.profileImageUrl) ?? toInitialsAvatarDataUrl(fullName)

      const headerName = document.querySelector('p._header_nav_para') as HTMLElement | null
      if (headerName) headerName.textContent = fullName

      const dropTitle = document.querySelector('h4._nav_dropdown_title') as HTMLElement | null
      if (dropTitle) dropTitle.textContent = fullName

      Array.from(document.querySelectorAll('img._nav_profile_img, img._nav_drop_img, img._txt_img, img._comment_img')).forEach(
        (node) => {
          const img = node as HTMLImageElement
          img.src = avatar
          img.alt = fullName
        }
      )
    }

    const normalizeTemplateProfileLinks = () => {
      const profileLinks = Array.from(
        document.querySelectorAll('a[href*="profile.html"]')
      ) as HTMLAnchorElement[]

      profileLinks.forEach((link) => {
        link.setAttribute('href', '/profile')
      })
    }

    const onDocClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (
        !target?.closest('._feed_timeline_dropdown') &&
        !target?.closest('button._feed_timeline_post_dropdown_link')
      ) {
        closePostDropdowns()
      }

      const anchor = target?.closest?.('a') as HTMLAnchorElement | null
      if (!anchor) return

      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return

      const rawHref = (anchor.getAttribute('href') ?? '').trim()
      if (!rawHref) return

      const normalized = rawHref.replace(/\s+/g, '')

      if (normalized === '#0' || normalized === '#') {
        event.preventDefault()
        return
      }

      if (normalized === '/profile' || normalized.endsWith('profile.html') || normalized.includes('profile.html')) {
        event.preventDefault()
        router.push('/profile')
        return
      }

      if (normalized.startsWith('/')) {
        event.preventDefault()
        router.push(normalized)
      }
    }

    const bindLogout = () => {
      const logoutLink = Array.from(document.querySelectorAll('a._nav_dropdown_link')).find((node) =>
        node.textContent?.toLowerCase().includes('log out')
      ) as HTMLAnchorElement | undefined

      if (!logoutLink) return

      logoutLink.addEventListener('click', async (event) => {
        event.preventDefault()
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
        window.location.href = '/login?loggedOut=1'
      })
    }

    let removeComposerBindings: (() => void) | undefined

    void (async () => {
      normalizeTemplateProfileLinks()
      document.addEventListener('click', onDocClick)
      bindLogout()
      removeComposerBindings = bindComposer()
      await hydrateHeader()
      await loadPosts()
    })()

    return () => {
      document.removeEventListener('click', onDocClick)
      removeComposerBindings?.()
    }
  }, [backendOrigin, router])

  return <div dangerouslySetInnerHTML={{ __html: FEED_HTML }} />
}
