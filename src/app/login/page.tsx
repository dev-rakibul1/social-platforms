'use client'

import { FormEvent, Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

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

type LoginPageShellProps = {
  loggedOut: boolean
  needsLogin: boolean
  nextPath: string
}

function LoginPageShell({ loggedOut, needsLogin, nextPath }: LoginPageShellProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const json = await response.json().catch(() => null)

      if (!response.ok || json?.success === false) {
        const base = getErrorMessage(json)
        setError(base === 'Something went wrong.' ? `Login failed (HTTP ${response.status}).` : base)
        return
      }

      router.replace(nextPath)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="_social_login_wrapper _layout_main_wrapper">
      <div className="_shape_one">
        <img src="assets/images/shape1.svg" alt="" className="_shape_img" />
        <img src="assets/images/dark_shape.svg" alt="" className="_dark_shape" />
      </div>
      <div className="_shape_two">
        <img src="assets/images/shape2.svg" alt="" className="_shape_img" />
        <img
          src="assets/images/dark_shape1.svg"
          alt=""
          className="_dark_shape _dark_shape_opacity"
        />
      </div>
      <div className="_shape_three">
        <img src="assets/images/shape3.svg" alt="" className="_shape_img" />
        <img
          src="assets/images/dark_shape2.svg"
          alt=""
          className="_dark_shape _dark_shape_opacity"
        />
      </div>
      <div className="_social_login_wrap">
        <div className="container">
          <div className="row align-items-center">
            <div className="col-xl-8 col-lg-8 col-md-12 col-sm-12">
              <div className="_social_login_left">
                <div className="_social_login_left_image">
                  <img src="assets/images/login.png" alt="Image" className="_left_img" />
                </div>
              </div>
            </div>
            <div className="col-xl-4 col-lg-4 col-md-12 col-sm-12">
              <div className="_social_login_content">
                <div className="_social_login_left_logo _mar_b28">
                  <img src="assets/images/logo.svg" alt="Image" className="_left_logo" />
                </div>
                <p className="_social_login_content_para _mar_b8">Welcome back</p>
                <h4 className="_social_login_content_title _titl4 _mar_b50">
                  Login to your account
                </h4>
                <button type="button" className="_social_login_content_btn _mar_b40">
                  <img src="assets/images/google.svg" alt="Image" className="_google_img" />{' '}
                  <span>Or sign-in with google</span>
                </button>
                <div className="_social_login_content_bottom_txt _mar_b40">
                  {' '}
                  <span>Or</span>
                </div>
                <form className="_social_login_form" onSubmit={onSubmit}>
                  {loggedOut ? (
                    <div className="alert alert-success py-2 _mar_b14" role="status" aria-live="polite">
                      Logged out successfully.
                    </div>
                  ) : needsLogin ? (
                    <div className="alert alert-info py-2 _mar_b14" role="status" aria-live="polite">
                      Please login to continue.
                    </div>
                  ) : null}
                  {error ? (
                    <div className="alert alert-danger py-2 _mar_b14" role="alert" aria-live="polite">
                      {error}
                    </div>
                  ) : null}
                  <div className="row">
                    <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                      <div className="_social_login_form_input _mar_b14">
                        <label className="_social_login_label _mar_b8">Email</label>
                        <input
                          type="email"
                          className="form-control _social_login_input"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                    <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
                      <div className="_social_login_form_input _mar_b14">
                        <label className="_social_login_label _mar_b8">Password</label>
                        <input
                          type="password"
                          className="form-control _social_login_input"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-lg-6 col-xl-6 col-md-6 col-sm-12">
                      <div className="form-check _social_login_form_check">
                        <input
                          className="form-check-input _social_login_form_check_input"
                          type="radio"
                          name="flexRadioDefault"
                          id="flexRadioDefault2"
                          defaultChecked
                        />
                        <label
                          className="form-check-label _social_login_form_check_label"
                          htmlFor="flexRadioDefault2"
                        >
                          Remember me
                        </label>
                      </div>
                    </div>
                    <div className="col-lg-6 col-xl-6 col-md-6 col-sm-12">
                      <div className="_social_login_form_left">
                        <p className="_social_login_form_left_para">Forgot password?</p>
                      </div>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-lg-12 col-md-12 col-xl-12 col-sm-12">
                      <div className="_social_login_form_btn _mar_t40 _mar_b60">
                        <button
                          type="submit"
                          className="_social_login_form_btn_link _btn1"
                          disabled={isSubmitting}
                        >
                          {isSubmitting ? (
                            <>
                              <span
                                className="spinner-border spinner-border-sm me-2"
                                role="status"
                                aria-hidden="true"
                              />
                              Logging in...
                            </>
                          ) : (
                            'Login now'
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
                <div className="row">
                  <div className="col-xl-12 col-lg-12 col-md-12 col-sm-12">
	                    <div className="_social_login_bottom_txt">
	                      <p className="_social_login_bottom_txt_para">
	                        Dont have an account?{' '}
	                        <a href={`/register?next=${encodeURIComponent(nextPath)}`}>Create New Account</a>
	                      </p>
	                    </div>
	                  </div>
	                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function LoginPageContent() {
  const searchParams = useSearchParams()

  return (
    <LoginPageShell
      loggedOut={searchParams.get('loggedOut') === '1'}
      needsLogin={searchParams.get('reason') === 'auth'}
      nextPath={searchParams.get('next')?.trim() || '/feed'}
    />
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={<LoginPageShell loggedOut={false} needsLogin={false} nextPath="/feed" />}
    >
      <LoginPageContent />
    </Suspense>
  )
}
