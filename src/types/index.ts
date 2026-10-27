export interface Account {
  id: string
  name: string
  type: string
  email: string
  /** Base64 ciphertext of the Cloudflare API token (matches backend kv.ts). */
  encryptedToken: string
  iv: string
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
