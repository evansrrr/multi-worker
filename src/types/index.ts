export interface Account {
  id: string
  name: string
  token_encrypted: string
  token_iv: string
  created_at: string
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
  modified_on: string
  routes: WorkerRoute[]
  bindings: WorkerBinding[]
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
  value: string
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
