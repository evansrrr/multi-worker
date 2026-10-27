export interface Account {
  id: string
  name: string
  type: string
  email: string
  /** Base64 ciphertext of the Cloudflare API token (matches backend kv.ts). */
  encryptedToken: string
  iv: string
}

export interface AccountMetadata {
  id: string
  name: string
  type: 'account' | 'subaccount'
  settings: Record<string, unknown>
}

export interface Worker {
  id: string
  name: string
  created_on: string
  /** Beta Workers API returns `updated_on`; classic scripts return `modified_on`. */
  updated_on?: string
  modified_on?: string
  deployed_on?: string
  logpush?: boolean
  subdomain?: { enabled: boolean; previews_enabled: boolean }
  tags?: string[]
  /** Only present for script-style listings — the Workers entity API omits these. */
  routes?: WorkerRoute[]
  bindings?: WorkerBinding[]
}

export interface WorkerRoute {
  pattern: string
  script: string
}

export interface WorkerBinding {
  type: string
  name: string
  namespace_id?: string
  database_id?: string
  value?: string
  service?: string
  domain?: string
}

export interface PagesProject {
  id: string
  name: string
  created_on: string
  subdomain: string
  domains: string[]
  deployment_trigger: {
    type: string
    metadata: Record<string, unknown>
  }
}

export interface KVNamespace {
  id: string
  title: string
  created_on: string
  modified_on: string
  description: string
}

export interface KVKey {
  name: string
  /** Unix seconds; omitted for keys that never expire (REST list shape). */
  expiration?: number
  metadata?: Record<string, unknown>
}

export interface D1Database {
  uuid: string
  name: string
  created_at: string
  file_size: number
}

export interface D1Table {
  name: string
  sql: string
}

export interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  meta: {
    duration?: number
    changes?: number
    last_row_id?: number
    changed_db?: boolean
    size_after?: number
    rows_read?: number
    rows_written?: number
  }
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
  }
}

export interface AuthState {
  isAuthenticated: boolean
  needsSetup: boolean
}

export type Appearance = 'light' | 'dark' | 'system'

export interface ResourceItem {
  name: string
  type: 'worker' | 'pages'
  accountId: string
  accountName: string
  modifiedOn: string
}
