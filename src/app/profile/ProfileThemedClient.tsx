'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FEED_HTML } from '../feed/feedHtml'

type MeUser = {
  id: string
  firstName: string
  lastName: string
  email: string
  profileImageUrl: string | null
  postCount?: number
}

type UserPost = {
  id: string
  text: string
  imageUrl: string | null
  visibility: 'PUBLIC' | 'PRIVATE'
  createdAt: string
}

const toInitials = (fullName: string) =>
  fullName
    .split(' ')
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

const toInitialsAvatarDataUrl = (fullName: string): string => {
  const initials = toInitials(fullName) || 'U'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#377DFF"/>
        <stop offset="100%" stop-color="#6C63FF"/>
      </linearGradient>
    </defs>
    <rect width="96" height="96" rx="48" fill="url(#g)"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" font-family="Poppins, Arial" font-size="34" fill="#fff" font-weight="600">${initials}</text>
  </svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

const normalizeBackendImageUrl = (backendOrigin: string, imageUrl: string | null): string | null => {
  if (!imageUrl) return null
  if (!imageUrl.startsWith('/')) return imageUrl
  return `${backendOrigin}${imageUrl}`
}

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('File read failed'))
    reader.readAsDataURL(file)
  })

export default function ProfileThemedClient({ backendOrigin }: { backendOrigin: string }) {
  const router = useRouter()

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
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

      if (normalized.endsWith('profile.html') || normalized.includes('profile.html')) {
        event.preventDefault()
        router.push('/profile')
        return
      }

      if (normalized.startsWith('/')) {
        event.preventDefault()
        router.push(normalized)
      }
    }

    document.addEventListener('click', onDocClick)

    const ensureEditPostModal = () => {
      const existing = document.querySelector('#_profile_edit_post_modal') as HTMLElement | null
      if (existing) return existing

      const modal = document.createElement('div')
      modal.className = 'modal fade'
      modal.id = '_profile_edit_post_modal'
      modal.tabIndex = -1
      modal.setAttribute('aria-hidden', 'true')

      modal.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">Edit post</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <div class="alert alert-danger d-none" id="_profile_edit_post_error"></div>
              <div class="mb-3">
                <label class="form-label">Text</label>
                <textarea class="form-control" id="_profile_edit_post_text" rows="4"></textarea>
              </div>
              <div class="mb-3">
                <label class="form-label">Image</label>
                <div class="d-grid gap-2">
                  <img id="_profile_edit_post_image_preview" alt="Post image" class="img-fluid rounded d-none" />
                  <div class="d-flex gap-2 flex-wrap">
                    <button type="button" class="btn btn-outline-primary btn-sm" id="_profile_edit_post_change_image_btn">Change image</button>
                    <button type="button" class="btn btn-outline-danger btn-sm" id="_profile_edit_post_remove_image_btn">Remove image</button>
                  </div>
                </div>
              </div>
              <div class="mb-3">
                <label class="form-label">Visibility</label>
                <select class="form-select" id="_profile_edit_post_visibility">
                  <option value="PUBLIC">Public</option>
                  <option value="PRIVATE">Private</option>
                </select>
              </div>
              <div class="d-flex justify-content-end">
                <button type="button" class="btn btn-primary" id="_profile_edit_post_save_btn">Save</button>
              </div>
            </div>
          </div>
        </div>
      `

      document.body.appendChild(modal)
      return modal
    }

	    const openEditPostModal = async (
	      post: UserPost,
	      onSaved: () => Promise<void>
		    ) => {
		      const modalEl = ensureEditPostModal()
		      const instance = (window as any).bootstrap?.Modal?.getOrCreateInstance?.(modalEl) ?? null
      const closeBtn = modalEl.querySelector('button.btn-close') as HTMLButtonElement | null

		      const showFallback = () => {
		        modalEl.style.display = 'block'
		        modalEl.removeAttribute('aria-hidden')
		        modalEl.setAttribute('aria-modal', 'true')
		        modalEl.setAttribute('role', 'dialog')
		        document.body.classList.add('modal-open')

		        if (!document.querySelector('#_profile_edit_post_backdrop')) {
		          const backdrop = document.createElement('div')
		          backdrop.id = '_profile_edit_post_backdrop'
		          backdrop.className = 'modal-backdrop fade show'
		          document.body.appendChild(backdrop)
		        }

		        modalEl.classList.remove('show')
		        requestAnimationFrame(() => modalEl.classList.add('show'))
		      }

		      const hideFallback = () => {
		        modalEl.classList.remove('show')
		        window.setTimeout(() => {
		          modalEl.style.display = 'none'
		          modalEl.setAttribute('aria-hidden', 'true')
		          document.body.classList.remove('modal-open')
		          document.querySelector('#_profile_edit_post_backdrop')?.remove()
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
        cloned.addEventListener('click', () => {
          hideModal()
        })
      }

      const textarea = modalEl.querySelector('#_profile_edit_post_text') as HTMLTextAreaElement | null
      const visibility = modalEl.querySelector('#_profile_edit_post_visibility') as HTMLSelectElement | null
      const saveBtn = modalEl.querySelector('#_profile_edit_post_save_btn') as HTMLButtonElement | null
      const errorEl = modalEl.querySelector('#_profile_edit_post_error') as HTMLElement | null
      const previewImg = modalEl.querySelector('#_profile_edit_post_image_preview') as HTMLImageElement | null
      const changeBtn = modalEl.querySelector('#_profile_edit_post_change_image_btn') as HTMLButtonElement | null
      const removeBtn = modalEl.querySelector('#_profile_edit_post_remove_image_btn') as HTMLButtonElement | null

      if (!textarea || !visibility || !saveBtn) return

      textarea.value = post.text
      visibility.value = post.visibility
      if (errorEl) {
        errorEl.classList.add('d-none')
        errorEl.textContent = ''
      }

      // Re-bind buttons per open to avoid accumulating listeners
      let saveBtnLive: HTMLButtonElement = saveBtn
      {
        const cloned = saveBtnLive.cloneNode(true) as HTMLButtonElement
        saveBtnLive.parentNode?.replaceChild(cloned, saveBtnLive)
        cloned.id = '_profile_edit_post_save_btn'
        saveBtnLive = cloned
      }

      let changeBtnLive: HTMLButtonElement | null = changeBtn
      if (changeBtnLive) {
        const cloned = changeBtnLive.cloneNode(true) as HTMLButtonElement
        changeBtnLive.parentNode?.replaceChild(cloned, changeBtnLive)
        cloned.id = '_profile_edit_post_change_image_btn'
        changeBtnLive = cloned
      }

      let removeBtnLive: HTMLButtonElement | null = removeBtn
      if (removeBtnLive) {
        const cloned = removeBtnLive.cloneNode(true) as HTMLButtonElement
        removeBtnLive.parentNode?.replaceChild(cloned, removeBtnLive)
        cloned.id = '_profile_edit_post_remove_image_btn'
        removeBtnLive = cloned
      }

      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = 'image/*'
      fileInput.style.display = 'none'
      document.body.appendChild(fileInput)

      const cleanupFileInput = () => {
        try {
          fileInput.remove()
        } catch {
          // ignore
        }
      }

      // Ensure cleanup when user closes the modal (Bootstrap path)
      modalEl.addEventListener('hidden.bs.modal', cleanupFileInput, { once: true })

      let editSelectedImage:
        | { contentBase64: string; mimeType: string; originalName?: string }
        | null = null
      let editRemoveImage = false

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
          editRemoveImage = true
          editSelectedImage = null
          fileInput.value = ''
          setPreview(null)
        })
      }

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0] ?? null
        if (!file) return
        const dataUrl = await readFileAsDataUrl(file)
        editSelectedImage = {
          contentBase64: dataUrl,
          mimeType: file.type || 'image/png',
          originalName: file.name,
        }
        editRemoveImage = false
        setPreview(dataUrl)
      })

      const setSaving = (saving: boolean) => {
        saveBtnLive.disabled = saving
        if (saving) {
          if (!saveBtnLive.querySelector('[data-spinner="1"]')) {
            const spinner = document.createElement('span')
            spinner.setAttribute('data-spinner', '1')
            spinner.className = 'spinner-border spinner-border-sm ms-2'
            spinner.setAttribute('role', 'status')
            spinner.setAttribute('aria-hidden', 'true')
            saveBtnLive.appendChild(spinner)
          }
        } else {
          saveBtnLive.querySelector('[data-spinner="1"]')?.remove()
        }
      }

      const handler = async () => {
        setSaving(true)
        try {
          const nextText = textarea.value
          if (!nextText.trim()) {
            if (errorEl) {
              errorEl.textContent = 'Text is required.'
              errorEl.classList.remove('d-none')
            }
            return
          }

          const payload: any = {
            text: nextText,
            visibility: visibility.value === 'PRIVATE' ? 'PRIVATE' : 'PUBLIC',
          }
          if (editRemoveImage) payload.removeImage = true
          if (editSelectedImage) payload.image = editSelectedImage

          const res = await fetch(`/api/posts/${post.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })

          if (res.status === 401) {
            window.location.href = '/login?reason=auth&next=/profile'
            return
          }

          if (!res.ok) {
            const json = await res.json().catch(() => null)
            if (errorEl) {
              errorEl.textContent = json?.message ?? 'Failed to update post.'
              errorEl.classList.remove('d-none')
            }
            return
	          }

	          await onSaved()
	          hideModal()
	        } finally {
	          cleanupFileInput()
	          setSaving(false)
	        }
	      }

      saveBtnLive.addEventListener('click', handler)

	      showModal()
	    }

    const bindLogout = () => {
      const logoutLink = Array.from(document.querySelectorAll('a._nav_dropdown_link')).find((el) =>
        el.textContent?.toLowerCase().includes('log out')
      ) as HTMLAnchorElement | undefined

      if (!logoutLink) return

      logoutLink.addEventListener('click', async (event) => {
        event.preventDefault()
        await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
        try {
          window.localStorage.clear()
          window.sessionStorage.clear()
        } catch {
          // ignore
        }
        window.location.href = '/login?loggedOut=1'
      })
    }

    const updateHeaderMe = (me: MeUser) => {
      const fullName = `${me.firstName} ${me.lastName}`.trim() || 'User'
      const headerName = document.querySelector('p._header_nav_para') as HTMLElement | null
      if (headerName) headerName.textContent = fullName

	      const dropName = document.querySelector('h4._nav_dropdown_title') as HTMLElement | null
	      if (dropName) dropName.textContent = fullName

	      const viewProfile = document.querySelector('a._nav_drop_profile') as HTMLAnchorElement | null
	      if (viewProfile) viewProfile.href = '/profile'

      const avatarUrl = me.profileImageUrl
        ? normalizeBackendImageUrl(backendOrigin, me.profileImageUrl)
        : toInitialsAvatarDataUrl(fullName)

      const headerAvatar = document.querySelector('img._nav_profile_img') as HTMLImageElement | null
      if (headerAvatar && avatarUrl) headerAvatar.src = avatarUrl

      const dropAvatar = document.querySelector('img._nav_drop_img') as HTMLImageElement | null
      if (dropAvatar && avatarUrl) dropAvatar.src = avatarUrl

      const composerAvatar = document.querySelector('img._txt_img') as HTMLImageElement | null
      if (composerAvatar && avatarUrl) composerAvatar.src = avatarUrl
    }

    const hideFeedOnlyBlocks = () => {
      ;[
        '._feed_inner_ppl_card',
        '._feed_inner_ppl_card_mobile',
        '._feed_inner_text_area',
        '._feed_inner_timeline_post_area',
      ].forEach((selector) => {
        Array.from(document.querySelectorAll(selector)).forEach((el) => {
          ;(el as HTMLElement).style.display = 'none'
        })
      })
    }

    const focusProfileLayout = () => {
      const leftWrap = document.querySelector('._layout_left_sidebar_wrap') as HTMLElement | null
      const rightWrap = document.querySelector('._layout_right_sidebar_wrap') as HTMLElement | null
      const middleWrap = document.querySelector('._layout_middle_wrap') as HTMLElement | null

      const leftCol = leftWrap?.closest('.col-xl-3') as HTMLElement | null
      const rightCol = rightWrap?.closest('.col-xl-3') as HTMLElement | null
      const middleCol = middleWrap?.closest('.col-xl-6') as HTMLElement | null

      if (leftCol) leftCol.style.display = 'none'
      if (rightCol) rightCol.style.display = 'none'

      if (middleCol) {
        middleCol.className = 'col-12'
      }
    }

    const ensureProfileRoot = (): HTMLElement | null => {
      const middle = document.querySelector('._layout_middle_inner') as HTMLElement | null
      if (!middle) return null

      let root = document.querySelector('#_profile_root') as HTMLElement | null
      if (!root) {
        root = document.createElement('div')
        root.id = '_profile_root'
        middle.insertAdjacentElement('afterbegin', root)
      }
      return root
    }

    const setStatus = (root: HTMLElement, html: string, kind: 'loading' | 'error' | 'info') => {
      root.innerHTML = ''
      const box = document.createElement('div')
      box.className =
        kind === 'loading'
          ? 'd-flex align-items-center py-3'
          : kind === 'error'
            ? 'alert alert-danger mt-3'
            : 'alert alert-secondary mt-3'
      box.innerHTML = html
      root.appendChild(box)
    }

    const renderProfile = (root: HTMLElement, me: MeUser, posts: UserPost[]) => {
      // Cleanup previously attached hidden file input (renderProfile can run multiple times).
      const previousCleanup = (root as any)._cleanupPhotoInput as undefined | (() => void)
      if (previousCleanup) {
        try {
          previousCleanup()
        } catch {
          // ignore
        }
        ;(root as any)._cleanupPhotoInput = undefined
      }

      const fullName = `${me.firstName} ${me.lastName}`.trim() || 'User'
      const avatarUrl = me.profileImageUrl
        ? normalizeBackendImageUrl(backendOrigin, me.profileImageUrl)
        : toInitialsAvatarDataUrl(fullName)

	      root.innerHTML = `
	        <div class="_feed_inner_text_area _b_radious6 _padd_b24 _padd_t24 _padd_r24 _padd_l24 _mar_b16">
	          <div class="position-relative" style="z-index:1">
	            <img src="assets/images/profile-cover-img.png" alt="Cover" class="img-fluid w-100 _b_radious6" />
	          </div>

	          <div class="d-flex align-items-end gap-3 flex-wrap mt-3" style="position:relative;z-index:2">
	            <img id="_profile_avatar" src="${avatarUrl ?? ''}" alt="Avatar" class="rounded-circle border border-3 border-white" style="width:84px;height:84px;object-fit:cover;margin-top:-42px;position:relative;z-index:2;background:#fff" />
	            <div class="pb-2">
	              <h4 class="_title5 m-0" id="_profile_name">${fullName}</h4>
	              <p class="_left_inner_area_suggest_info_para m-0" id="_profile_email">${me.email}</p>
	            </div>
	          </div>
	
	          <div class="pt-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
	            <div class="d-flex gap-4 flex-wrap">
	              <div>
	                <div class="fw-semibold">${me.postCount ?? posts.length}</div>
	                <div class="text-muted small">Posts</div>
              </div>
              <div>
                <div class="fw-semibold">${me.id}</div>
                <div class="text-muted small">User ID</div>
              </div>
            </div>
            <div class="d-flex gap-2">
              <button type="button" class="btn btn-outline-primary btn-sm" id="_profile_change_photo_btn">Update photo</button>
              <button type="button" class="btn btn-primary btn-sm" id="_profile_edit_btn">Edit profile</button>
            </div>
          </div>

          <div class="alert alert-danger d-none mt-3" id="_profile_error"></div>

          <div class="mt-3 d-none" id="_profile_edit_form">
            <div class="row g-3">
              <div class="col-12 col-md-6">
                <label class="form-label">First name</label>
                <input class="form-control" id="_profile_firstName" value="${me.firstName.replaceAll('"', '&quot;')}" />
              </div>
              <div class="col-12 col-md-6">
                <label class="form-label">Last name</label>
                <input class="form-control" id="_profile_lastName" value="${me.lastName.replaceAll('"', '&quot;')}" />
              </div>
              <div class="col-12">
                <label class="form-label">Email</label>
                <input class="form-control" id="_profile_email_input" type="email" value="${me.email.replaceAll('"', '&quot;')}" />
              </div>
            </div>
            <div class="d-flex justify-content-end mt-3 gap-2">
              <button type="button" class="btn btn-outline-secondary btn-sm" id="_profile_cancel_btn">Cancel</button>
              <button type="button" class="btn btn-primary btn-sm" id="_profile_save_btn">Save</button>
            </div>
          </div>
        </div>

        <div class="_feed_inner_timeline_post_area _b_radious6 _padd_b24 _padd_t24 _mar_b16">
          <div class="_feed_inner_timeline_content _padd_r24 _padd_l24">
            <div class="d-flex align-items-center justify-content-between mb-3">
              <h4 class="_feed_inner_area_right_title _title5 m-0">My posts</h4>
              <a href="/feed" class="_left_inner_event_link">Back to feed</a>
            </div>
            <div class="d-grid gap-3" id="_profile_posts"></div>
          </div>
        </div>
      `

      const postsRoot = root.querySelector('#_profile_posts') as HTMLElement | null
      if (postsRoot) {
        if (!posts.length) {
          const empty = document.createElement('div')
          empty.className = 'text-muted'
          empty.textContent = 'No posts yet.'
          postsRoot.appendChild(empty)
        } else {
          posts.forEach((post) => {
            const normalizedImageUrl = normalizeBackendImageUrl(backendOrigin, post.imageUrl)
            const imageHtml = normalizedImageUrl
              ? `<div class="mt-3"><img src="${normalizedImageUrl.replaceAll('"', '&quot;')}" alt="Post image" class="img-fluid w-100 _b_radious6" style="object-fit:cover" /></div>`
              : ''

            const item = document.createElement('div')
            item.className = '_feed_inner_text_area _b_radious6 _padd_b24 _padd_t24 _padd_r24 _padd_l24'
            item.innerHTML = `
              <div class="d-flex align-items-start justify-content-between gap-3">
                <div class="flex-grow-1">
                  <div class="d-flex align-items-center justify-content-between gap-3">
                    <div class="d-flex align-items-center gap-2">
                      <img src="${avatarUrl ?? ''}" alt="${fullName}" class="rounded-circle" style="width:28px;height:28px;object-fit:cover" />
                      <div class="lh-sm">
                        <div class="fw-semibold small">${fullName}</div>
                        <div class="text-muted small">${new Date(post.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                    <div class="text-muted small">${post.visibility === 'PRIVATE' ? 'Private' : 'Public'}</div>
                  </div>
                  <div class="mt-2" style="white-space:pre-wrap;word-break:break-word">${post.text
                    .replaceAll('<', '&lt;')
                    .replaceAll('>', '&gt;')}</div>
                  ${imageHtml}
                </div>
                <button type="button" class="btn btn-outline-primary btn-sm" data-edit-post="${post.id}">Edit</button>
              </div>
            `
            postsRoot.appendChild(item)
          })
        }
      }

      // Bind edit + save
      const editBtn = root.querySelector('#_profile_edit_btn') as HTMLButtonElement | null
      const editForm = root.querySelector('#_profile_edit_form') as HTMLElement | null
      const cancelBtn = root.querySelector('#_profile_cancel_btn') as HTMLButtonElement | null
      const saveBtn = root.querySelector('#_profile_save_btn') as HTMLButtonElement | null
      const errorEl = root.querySelector('#_profile_error') as HTMLElement | null
      const firstNameInput = root.querySelector('#_profile_firstName') as HTMLInputElement | null
      const lastNameInput = root.querySelector('#_profile_lastName') as HTMLInputElement | null
      const emailInput = root.querySelector('#_profile_email_input') as HTMLInputElement | null

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

      if (editBtn && editForm) {
        editBtn.addEventListener('click', () => {
          editForm.classList.toggle('d-none')
        })
      }

      if (cancelBtn && editForm) {
        cancelBtn.addEventListener('click', () => {
          setError(null)
          editForm.classList.add('d-none')
          if (firstNameInput) firstNameInput.value = me.firstName
          if (lastNameInput) lastNameInput.value = me.lastName
          if (emailInput) emailInput.value = me.email
        })
      }

      const setButtonLoading = (button: HTMLButtonElement, loading: boolean) => {
        button.disabled = loading
        if (loading) {
          if (!button.querySelector('[data-spinner="1"]')) {
            const spinner = document.createElement('span')
            spinner.setAttribute('data-spinner', '1')
            spinner.className = 'spinner-border spinner-border-sm ms-2'
            spinner.setAttribute('role', 'status')
            spinner.setAttribute('aria-hidden', 'true')
            button.appendChild(spinner)
          }
        } else {
          button.querySelector('[data-spinner="1"]')?.remove()
        }
      }

      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          if (!firstNameInput || !lastNameInput || !emailInput) return
          setError(null)
          setButtonLoading(saveBtn, true)

          try {
            const res = await fetch('/api/users/me', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                firstName: firstNameInput.value.trim(),
                lastName: lastNameInput.value.trim(),
                email: emailInput.value.trim(),
              }),
            })

            if (res.status === 401) {
              window.location.href = '/login?reason=auth&next=/profile'
              return
            }

            const json = await res.json().catch(() => null)
            if (!res.ok) {
              setError(json?.message ?? 'Failed to update profile.')
              return
            }

            const nextMe = (json?.data ?? null) as MeUser | null
            if (nextMe) {
              updateHeaderMe(nextMe)
              const nameEl = root.querySelector('#_profile_name') as HTMLElement | null
              const emailEl = root.querySelector('#_profile_email') as HTMLElement | null
              if (nameEl) nameEl.textContent = `${nextMe.firstName} ${nextMe.lastName}`.trim() || 'User'
              if (emailEl) emailEl.textContent = nextMe.email
              if (firstNameInput) firstNameInput.value = nextMe.firstName
              if (lastNameInput) lastNameInput.value = nextMe.lastName
              if (emailInput) emailInput.value = nextMe.email
              editForm?.classList.add('d-none')
            }
          } finally {
            setButtonLoading(saveBtn, false)
          }
        })
      }

      const photoBtn = root.querySelector('#_profile_change_photo_btn') as HTMLButtonElement | null
      if (photoBtn) {
        const fileInput = document.createElement('input')
        fileInput.type = 'file'
        fileInput.accept = 'image/*'
        fileInput.style.display = 'none'
        document.body.appendChild(fileInput)

        const cleanup = () => fileInput.remove()
        ;(root as any)._cleanupPhotoInput = cleanup

        photoBtn.addEventListener('click', () => fileInput.click())
        fileInput.addEventListener('change', async () => {
          const file = fileInput.files?.[0] ?? null
          if (!file) return
          setError(null)
          setButtonLoading(photoBtn, true)

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
              window.location.href = '/login?reason=auth&next=/profile'
              return
            }

            const json = await res.json().catch(() => null)
            if (!res.ok) {
              setError(json?.message ?? 'Failed to upload profile image.')
              return
            }

            const nextMe = (json?.data ?? null) as MeUser | null
            if (nextMe) {
              updateHeaderMe(nextMe)
              const nextFullName = `${nextMe.firstName} ${nextMe.lastName}`.trim() || 'User'
              const avatar = root.querySelector('#_profile_avatar') as HTMLImageElement | null
              const nextAvatar = nextMe.profileImageUrl
                ? normalizeBackendImageUrl(backendOrigin, nextMe.profileImageUrl)
                : toInitialsAvatarDataUrl(nextFullName)
              if (avatar && nextAvatar) avatar.src = nextAvatar
            }
          } finally {
            setButtonLoading(photoBtn, false)
            fileInput.value = ''
          }
        })
      }

      // Bind per-post edit
      root.querySelectorAll('[data-edit-post]').forEach((button) => {
        button.addEventListener('click', async () => {
          const postId = (button as HTMLElement).getAttribute('data-edit-post')
          if (!postId) return
          const post = posts.find((p) => p.id === postId)
          if (!post) return

          await openEditPostModal(post, async () => {
            // reload posts quickly
            const postsRes = await fetch(`/api/users/${me.id}/posts?limit=20`, { cache: 'no-store' })
            if (postsRes.status === 401) {
              window.location.href = '/login?reason=auth&next=/profile'
              return
            }
            const postsJson = await postsRes.json().catch(() => null)
            const nextPosts = ((postsJson?.data ?? []) as UserPost[]) ?? []
            renderProfile(root, me, nextPosts)
          })
        })
      })
    }

    const load = async () => {
      hideFeedOnlyBlocks()
      focusProfileLayout()
      bindLogout()

      const root = ensureProfileRoot()
      if (!root) return

      setStatus(
        root,
        `<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>Loading profile...`,
        'loading'
      )

      const meRes = await fetch('/api/users/me', { cache: 'no-store' })
      if (meRes.status === 401) {
        window.location.href = '/login?reason=auth&next=/profile'
        return
      }
      if (!meRes.ok) {
        setStatus(root, 'Failed to load profile.', 'error')
        return
      }

      const meJson = await meRes.json().catch(() => null)
      const me = (meJson?.data ?? null) as MeUser | null
      if (!me) {
        setStatus(root, 'Failed to load profile.', 'error')
        return
      }

      updateHeaderMe(me)

      const postsRes = await fetch(`/api/users/${me.id}/posts?limit=20`, { cache: 'no-store' })
      if (postsRes.status === 401) {
        window.location.href = '/login?reason=auth&next=/profile'
        return
      }
      const postsJson = await postsRes.json().catch(() => null)
      const posts = ((postsJson?.data ?? []) as UserPost[]) ?? []

      renderProfile(root, me, posts)
    }

    void load()

	    return () => {
	      document.removeEventListener('click', onDocClick)
	      const root = document.querySelector('#_profile_root') as any
	      root?._cleanupPhotoInput?.()
	      const modal = document.querySelector('#_profile_edit_post_modal') as HTMLElement | null
	      modal?.remove()
	      document.querySelector('#_profile_edit_post_backdrop')?.remove()
	    }
	  }, [backendOrigin, router])

  return <div dangerouslySetInnerHTML={{ __html: FEED_HTML }} />
}
