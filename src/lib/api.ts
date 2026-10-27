/**
 * Typed API client for the multi-worker frontend.
 *
 * Contract for callers:
 * - api<T>() resolves with the parsed JSON body on success, throws ApiError otherwise.
 * - Non-GET failures auto-emit an error toast (opt out with `silent: true`).
 * - GET failures do NOT toast — pages show ErrorBanner for load errors.
 * - 401 responses redirect to /login (auth endpoints are exempt so the login
 *   page can render its own error for a wrong password).
 * - FormData bodies pass through untouched (no Content-Type set, so fetch
 *   generates the multipart boundary).
 */

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export type ToastKind = 'success' | 'error' | 'info'

type ToastListener = (message: string, type: ToastKind) => void
const toastListeners = new Set<ToastListener>()

/** Subscribe to the module-level toast bus (used by the ToastBridge in App). */
export function subscribeToast(listener: ToastListener): () => void {
  toastListeners.add(listener)
  return () => {
    toastListeners.delete(listener)
  }
}

/** Emit a toast from outside React (e.g. inside api()). */
export function emitToast(message: string, type: ToastKind = 'info'): void {
  toastListeners.forEach((listener) => listener(message, type))
}

export type ApiRequestInit = RequestInit & {
  /** Suppress the automatic error toast (page shows its own feedback). */
  silent?: boolean
}

function shouldRedirectToLogin(path: string): boolean {
  // Auth endpoints return 401 for wrong credentials — that must not redirect.
  return !path.startsWith('/api/auth/')
}

export async function api<T = unknown>(
  path: string,
  options: ApiRequestInit = {}
): Promise<T> {
  const { silent, ...init } = options
  const headers = new Headers(init.headers)

  let body = init.body
  const isFormData = body instanceof FormData
  if (body !== undefined && !isFormData && typeof body !== 'string') {
    // Plain objects etc. are serialized as JSON.
    body = JSON.stringify(body)
  }
  if (typeof body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(path, { ...init, body, headers })
  } catch {
    const message = '网络异常，请检查网络连接'
    if (!silent && init.method && init.method !== 'GET') {
      emitToast(message, 'error')
    }
    throw new ApiError(message, 0)
  }

  if (response.status === 401 && shouldRedirectToLogin(path)) {
    emitToast('登录已过期，请重新登录', 'error')
    if (window.location.pathname !== '/login') {
      window.location.href = '/login'
    }
    throw new ApiError('登录已过期，请重新登录', 401)
  }

  let data: unknown = null
  const text = await response.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  const rawError =
    data && typeof data === 'object' && 'error' in data
      ? (data as { error?: unknown }).error
      : undefined
  // Endpoints return either `error: "string"` or `error: { code, message }`.
  const errorField =
    typeof rawError === 'string'
      ? rawError
      : rawError && typeof rawError === 'object' && 'message' in rawError
        ? String((rawError as { message?: unknown }).message ?? '')
        : undefined

  if (!response.ok || errorField) {
    const message =
      errorField && errorField.trim()
        ? errorField
        : `请求失败 (${response.status})`
    const isMutation = init.method && init.method !== 'GET'
    if (!silent && isMutation) {
      emitToast(message, 'error')
    }
    throw new ApiError(message, response.status)
  }

  return data as T
}

/** Convenience helpers — same contract as api(). */
export const apiGet = <T = unknown>(path: string, options?: ApiRequestInit) =>
  api<T>(path, { ...options, method: 'GET' })

export const apiPost = <T = unknown>(
  path: string,
  body?: unknown,
  options?: ApiRequestInit
) => api<T>(path, { ...options, method: 'POST', body: body as BodyInit })

export const apiPut = <T = unknown>(
  path: string,
  body?: unknown,
  options?: ApiRequestInit
) => api<T>(path, { ...options, method: 'PUT', body: body as BodyInit })

export const apiDelete = <T = unknown>(path: string, options?: ApiRequestInit) =>
  api<T>(path, { ...options, method: 'DELETE' })
