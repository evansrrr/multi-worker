import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import ErrorBanner from '../../components/ui/ErrorBanner'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import { apiGet, apiPost, apiDelete } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

interface D1Database {
  uuid: string
  name: string
  created_at?: string
  file_size?: number
  num_tables?: number
}

interface D1Table {
  name: string
  type: string
}

interface D1QueryResult {
  meta?: {
    duration?: number
    changes?: number
    last_row_id?: number
    rows_read?: number
    rows_written?: number
  }
  results?: Record<string, unknown>[]
  success?: boolean
}

export default function D1() {
  const { accountId, databaseId } = useParams()
  const navigate = useNavigate()
  const [databases, setDatabases] = useState<D1Database[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 选中态入 URL（H9）：/accounts/:accountId/d1/:databaseId
  const selectedDb = databaseId
    ? databases.find((d) => d.uuid === databaseId) ?? null
    : null

  const openDatabase = (db: D1Database) =>
    navigate(`/accounts/${accountId}/d1/${encodeURIComponent(db.uuid)}`)
  const closeDatabase = () => {
    setQueryResults(null)
    setSqlQuery('')
    setTables([])
    navigate(`/accounts/${accountId}/d1`)
  }

  const [tables, setTables] = useState<D1Table[]>([])
  const [tablesLoading, setTablesLoading] = useState(false)

  // SQL editor state
  const [sqlQuery, setSqlQuery] = useState('')
  const [queryResults, setQueryResults] = useState<D1QueryResult | null>(null)
  const [queryLoading, setQueryLoading] = useState(false)
  const [queryError, setQueryError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [deleteTarget, setDeleteTarget] = useState<D1Database | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const { addToast } = useToast()

  const fetchDatabases = useCallback(async () => {
    try {
      const data = await apiGet<{ databases?: D1Database[] }>(`/api/accounts/${accountId}/d1`)
      setDatabases(data.databases || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 D1 数据库失败')
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    fetchDatabases()
  }, [fetchDatabases])

  const fetchTables = useCallback(
    async (databaseId: string) => {
      setTablesLoading(true)
      try {
        const data = await apiGet<{ tables?: D1Table[] }>(
          `/api/accounts/${accountId}/d1/${databaseId}/tables`
        )
        setTables(data.tables || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载数据表失败')
      } finally {
        setTablesLoading(false)
      }
    },
    [accountId]
  )

  useEffect(() => {
    if (databaseId) {
      fetchTables(databaseId)
    }
  }, [databaseId, fetchTables])

  const handleCreateDatabase = async (name: string) => {
    // silent: 创建弹窗内联展示表单错误
    const data = await apiPost<{ database?: D1Database }>(
      `/api/accounts/${accountId}/d1`,
      { name },
      { silent: true }
    )
    if (data.database) {
      const created = data.database
      setDatabases((prev) => [...prev, created])
    }
    addToast('数据库创建成功', 'success')
  }

  const handleDeleteDatabase = async (db: D1Database) => {
    setDeletingId(db.uuid)
    setConfirmLoading(true)
    try {
      await apiDelete(`/api/accounts/${accountId}/d1/${db.uuid}`)
      addToast('删除成功', 'success')
      setDatabases((prev) => prev.filter((d) => d.uuid !== db.uuid))
      // 删除的正是当前打开的数据库时回列表（URL 已失效）
      if (selectedDb?.uuid === db.uuid) {
        closeDatabase()
      }
      setDeleteTarget(null)
    } catch {
      // api 已自动弹出错误 toast，此处仅收尾
    } finally {
      setDeletingId(null)
      setConfirmLoading(false)
    }
  }

  const handleExecuteQuery = async () => {
    if (!selectedDb || !sqlQuery.trim()) return
    setQueryLoading(true)
    setQueryError('')
    setQueryResults(null)
    try {
      // silent: SQL 控制台内联 queryError 展示
      const data = await apiPost<{ result?: D1QueryResult[] }>(
        `/api/accounts/${accountId}/d1/${selectedDb.uuid}/query`,
        { sql: sqlQuery.trim() },
        { silent: true }
      )
      const results = data.result?.[0] || { success: true, results: [] }
      setQueryResults(results)
      // Refresh tables list after schema changes
      if (sqlQuery.trim().match(/^\s*(CREATE|ALTER|DROP)\s/i)) {
        fetchTables(selectedDb.uuid)
      }
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : '执行查询失败')
    } finally {
      setQueryLoading(false)
    }
  }

  function formatSize(bytes?: number): string {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  function formatDate(dateStr?: string): string {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="max-w-6xl mx-auto">
      {selectedDb ? (
          /* Database detail view */
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <button
                  onClick={closeDatabase}
                  className="text-sm text-text-muted hover:text-text-main mb-2 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Databases
                </button>
                <h1 className="text-3xl font-bold text-cf-orange">{selectedDb.name}</h1>
                <p className="text-text-muted mt-1">Database details and SQL console</p>
              </div>
            </div>

            <ErrorBanner error={error} onDismiss={() => setError('')} />

            {/* Tables section */}
            <div className="bg-surface-2 rounded-xl shadow-lg border border-border-subtle mb-6">
              <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-main">Tables</h2>
                <Button variant="secondary" onClick={() => fetchTables(selectedDb.uuid)} className="text-sm px-3 py-1">
                  Refresh
                </Button>
              </div>
              {tablesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin h-6 w-6 border-4 border-cf-orange border-t-transparent rounded-full" />
                </div>
              ) : tables.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-text-muted">No tables found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-subtle">
                        <th className="text-left py-3 px-4 text-sm font-medium text-text-muted">Table Name</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-text-muted">Type</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-text-muted">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tables.map((table) => (
                        <tr key={table.name} className="border-b border-border-subtle/50 hover:bg-surface-3/30 transition-colors">
                          <td className="py-3 px-4">
                            <span className="text-text-main font-mono text-sm">{table.name}</span>
                          </td>
                          <td className="py-3 px-4 text-sm text-text-muted">{table.type}</td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="secondary"
                              onClick={() => setSqlQuery(`SELECT * FROM ${table.name} LIMIT 100;`)}
                              className="text-sm px-3 py-1"
                            >
                              Query
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* SQL Query Editor */}
            <div className="bg-surface-2 rounded-xl shadow-lg border border-border-subtle">
              <div className="px-4 py-3 border-b border-border-subtle">
                <h2 className="text-lg font-semibold text-text-main">SQL Console</h2>
              </div>
              <div className="p-4">
                <textarea
                  ref={textareaRef}
                  className="w-full px-3 py-2 bg-surface border border-border-strong rounded-lg text-text-main placeholder-text-faint focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent h-32 font-mono text-sm resize-y"
                  placeholder="Enter SQL query... (e.g. SELECT * FROM my_table)"
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault()
                      handleExecuteQuery()
                    }
                  }}
                />
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-text-faint">Ctrl+Enter to execute</p>
                  <Button onClick={handleExecuteQuery} loading={queryLoading} disabled={!sqlQuery.trim()}>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                    Execute
                  </Button>
                </div>
              </div>

              {queryError && (
                <div className="mx-4">
                  <ErrorBanner error={queryError} onDismiss={() => setQueryError('')} />
                </div>
              )}

              {queryResults && (
                <div className="border-t border-border-subtle">
                  {/* Query metadata */}
                  {queryResults.meta && (
                    <div className="px-4 py-2 border-b border-border-subtle flex flex-wrap gap-4 text-xs text-text-muted">
                      {queryResults.meta.duration != null && <span>Duration: {queryResults.meta.duration.toFixed(2)}ms</span>}
                      {queryResults.meta.rows_read != null && <span>Rows read: {queryResults.meta.rows_read}</span>}
                      {queryResults.meta.rows_written != null && <span>Rows written: {queryResults.meta.rows_written}</span>}
                      {queryResults.meta.changes != null && <span>Changes: {queryResults.meta.changes}</span>}
                    </div>
                  )}
                  {/* Results table */}
                  {queryResults.results && queryResults.results.length > 0 ? (
                    (() => {
                      const columns = Object.keys(queryResults.results[0] as Record<string, unknown>)
                      return (
                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                      <table className="w-full">
                        <thead className="sticky top-0 bg-surface-2">
                          <tr className="border-b border-border-subtle">
                            {columns.map((col) => (
                              <th key={col} className="text-left py-2 px-4 text-sm font-medium text-text-muted whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResults.results.map((row, idx) => (
                            <tr key={idx} className="border-b border-border-subtle/50 hover:bg-surface-3/30">
                              {columns.map((col) => (
                                <td key={col} className="py-2 px-4 text-sm text-text-main font-mono whitespace-nowrap max-w-xs truncate">
                                  {row[col] === null ? <span className="text-text-faint italic">NULL</span> : String(row[col])}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                      )
                    })()
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-text-muted text-sm">
                        {queryResults.success ? 'Query executed successfully (no results)' : 'Query failed'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Database list view */
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-cf-orange">D1 Databases</h1>
                <p className="text-text-muted mt-1">Manage D1 databases for this account</p>
              </div>
              <Button onClick={() => setShowCreateModal(true)}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create Database
              </Button>
            </div>

            <ErrorBanner error={error} onDismiss={() => setError('')} />

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-8 w-8 border-4 border-cf-orange border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="bg-surface-2 rounded-xl shadow-lg border border-border-subtle">
                {databases.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 text-text-faint mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                    </svg>
                    <p className="text-text-muted">No D1 databases found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border-subtle">
                          <th className="text-left py-3 px-4 text-sm font-medium text-text-muted">Name</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-text-muted">UUID</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-text-muted">Created</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-text-muted">Size</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-text-muted">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {databases.map((db) => (
                          <tr key={db.uuid} className="border-b border-border-subtle/50 hover:bg-surface-3/30 transition-colors">
                            <td className="py-3 px-4">
                              <button
                                onClick={() => openDatabase(db)}
                                className="flex items-center gap-3 text-left hover:opacity-80"
                              >
                                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                  <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                                  </svg>
                                </div>
                                <span className="text-text-main font-medium">{db.name}</span>
                              </button>
                            </td>
                            <td className="py-3 px-4 text-sm text-text-muted font-mono">{db.uuid}</td>
                            <td className="py-3 px-4 text-sm text-text-muted">{formatDate(db.created_at)}</td>
                            <td className="py-3 px-4 text-sm text-text-muted">{formatSize(db.file_size)}</td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="secondary" onClick={() => openDatabase(db)} className="text-sm px-3 py-1">
                                  Open
                                </Button>
                                <Button
                                  variant="danger"
                                  onClick={() => setDeleteTarget(db)}
                                  loading={deletingId === db.uuid}
                                  className="text-sm px-3 py-1"
                                >
                                  Delete
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Create Database Modal */}
        {showCreateModal && (
          <CreateDatabaseModal
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateDatabase}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={deleteTarget !== null}
          title="删除数据库"
          message={`确定要删除 D1 数据库 "${deleteTarget?.name}" 吗？此操作不可撤销。`}
          confirmText="删除"
          danger
          requireName={deleteTarget?.name}
          loading={confirmLoading}
          onConfirm={() => {
            if (deleteTarget) handleDeleteDatabase(deleteTarget)
          }}
          onClose={() => setDeleteTarget(null)}
        />
    </div>
  )
}

function CreateDatabaseModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (name: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onCreate(name)
      setName('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create database')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setName('')
      setError('')
      onClose()
    }
  }

  return (
    <Modal open title="Create D1 Database" onClose={handleClose} closable={!loading} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="db-name"
          label="Database Name"
          placeholder="my-database"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={!name} className="flex-1">
            Create Database
          </Button>
        </div>
      </form>
    </Modal>
  )
}
