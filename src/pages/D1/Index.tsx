import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import ErrorBanner from '../../components/ui/ErrorBanner'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import DataTable, { DataTableColumn } from '../../components/ui/DataTable'
import PageHeader from '../../components/ui/PageHeader'
import LoadingBlock from '../../components/ui/LoadingBlock'
import EmptyState from '../../components/ui/EmptyState'
import { apiGet, apiPost, apiDelete } from '../../lib/api'
import { formatDateTime } from '../../lib/datetime'
import { useToast } from '../../hooks/useToast'

interface D1Database {
  uuid: string
  name: string
  created_at?: string
  file_size?: number
  num_tables?: number
}

interface D1SchemaObject {
  name: string
  /** sqlite_master 的原始 type（table/view/index/trigger）。 */
  type: string
  /** 归一化类型，取值 table|view|index|trigger|other。 */
  kind: string
  /** 索引/触发器归属的表名。 */
  tbl_name?: string
  /** DDL 语句，视图定义可直接展示，可能为 null。 */
  sql?: string
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
  /** 语句级失败时 D1 直接给字符串 error（见 AUDIT M6）。 */
  error?: string
  errors?: Array<{ code?: number; message?: string }>
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
    setSqlParams('')
    setTables([])
    setViews([])
    setIndexes([])
    setTriggers([])
    navigate(`/accounts/${accountId}/d1`)
  }

  const [tables, setTables] = useState<D1SchemaObject[]>([])
  const [views, setViews] = useState<D1SchemaObject[]>([])
  const [indexes, setIndexes] = useState<D1SchemaObject[]>([])
  const [triggers, setTriggers] = useState<D1SchemaObject[]>([])
  const [tablesLoading, setTablesLoading] = useState(false)

  // SQL editor state
  const [sqlQuery, setSqlQuery] = useState('')
  const [sqlParams, setSqlParams] = useState('')
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
        const data = await apiGet<{
          tables?: D1SchemaObject[]
          views?: D1SchemaObject[]
          indexes?: D1SchemaObject[]
          triggers?: D1SchemaObject[]
        }>(`/api/accounts/${accountId}/d1/${databaseId}/tables`)
        setTables(data.tables || [])
        setViews(data.views || [])
        setIndexes(data.indexes || [])
        setTriggers(data.triggers || [])
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
      // 参数化：一行一个参数，只接受 string/number/boolean/null 字面量。
      const params = sqlParams.trim()
        ? sqlParams
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line !== '')
            .map((line) => {
              if (line === 'null') return null
              if (line === 'true') return true
              if (line === 'false') return false
              if (line !== '' && !Number.isNaN(Number(line))) return Number(line)
              return line
            })
        : undefined

      // silent: SQL 控制台内联 queryError 展示
      const data = await apiPost<{
        result?: D1QueryResult[]
        statement_errors?: Array<{ index: number; error: string }>
        success?: boolean
      }>(
        `/api/accounts/${accountId}/d1/${selectedDb.uuid}/query`,
        { sql: sqlQuery.trim(), params },
        { silent: true }
      )

      const results = data.result?.[0] || { success: true, results: [] }
      setQueryResults(results)

      // 语句级失败：外层 200，但 result[i].success === false（见 AUDIT M6）。
      if (data.success === false || results.success === false) {
        const firstError =
          data.statement_errors?.[0]?.error ||
          results.error ||
          results.errors?.[0]?.message ||
          '查询失败'
        setQueryError(firstError)
      }

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

  const exportCsv = () => {
    if (!queryResults?.results || queryResults.results.length === 0) return
    const columns = Object.keys(queryResults.results[0] as Record<string, unknown>)
    const escape = (v: unknown) => {
      const s = v === null ? '' : String(v)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [
      columns.map(escape).join(','),
      ...queryResults.results.map((row) =>
        columns.map((col) => escape(row[col])).join(',')
      ),
    ]
    // 加 BOM，让 Excel 正确识别 UTF-8
    const blob = new Blob(['\uFEFF' + lines.join('\n')], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'd1-export.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const runExplain = () => {
    if (!sqlQuery.trim()) return
    setSqlQuery(`EXPLAIN ${sqlQuery.trim()}`)
    // 直接执行 EXPLAIN 版本，无需等待用户再点一次
    setQueryLoading(true)
    setQueryError('')
    setQueryResults(null)
    apiPost<{
      result?: D1QueryResult[]
      statement_errors?: Array<{ index: number; error: string }>
      success?: boolean
    }>(
      `/api/accounts/${accountId}/d1/${selectedDb?.uuid}/query`,
      { sql: `EXPLAIN ${sqlQuery.trim()}` },
      { silent: true }
    )
      .then((data) => {
        const results = data.result?.[0] || { success: true, results: [] }
        setQueryResults(results)
        if (data.success === false || results.success === false) {
          setQueryError(
            data.statement_errors?.[0]?.error ||
              results.error ||
              results.errors?.[0]?.message ||
              'EXPLAIN 失败'
          )
        }
      })
      .catch((err) => setQueryError(err instanceof Error ? err.message : 'EXPLAIN 失败'))
      .finally(() => setQueryLoading(false))
  }

  function formatSize(bytes?: number): string {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const databaseColumns: DataTableColumn<D1Database>[] = [
    {
      key: 'name',
      header: '名称',
      value: (db) => db.name,
      sortable: true,
      render: (db) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <svg
              className="w-4 h-4 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375"
              />
            </svg>
          </div>
          <span className="text-text-main font-medium">{db.name}</span>
        </div>
      ),
    },
    {
      key: 'uuid',
      header: 'UUID',
      value: (db) => db.uuid,
      render: (db) => <span className="font-mono text-text-muted">{db.uuid}</span>,
    },
    {
      key: 'created',
      header: '创建时间',
      value: (db) => formatDateTime(db.created_at),
      sortable: true,
      render: (db) => <span className="text-text-muted">{formatDateTime(db.created_at)}</span>,
    },
    {
      key: 'size',
      header: '大小',
      value: (db) => formatSize(db.file_size),
      render: (db) => <span className="text-text-muted">{formatSize(db.file_size)}</span>,
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      stopRowClick: true,
      searchable: false,
      render: (db) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => openDatabase(db)} className="text-sm px-3 py-1">
            打开
          </Button>
          <Button
            variant="danger"
            onClick={() => setDeleteTarget(db)}
            loading={deletingId === db.uuid}
            className="text-sm px-3 py-1"
          >
            删除
          </Button>
        </div>
      ),
    },
  ]

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
                  返回数据库列表
                </button>
                <h1 className="text-3xl font-bold text-cf-orange">{selectedDb.name}</h1>
                <p className="text-text-muted mt-1">数据库详情与 SQL 控制台</p>
              </div>
            </div>

            <ErrorBanner error={error} onDismiss={() => setError('')} />

            {/* Tables / schema section */}
            <div className="bg-surface-2 rounded-xl shadow-lg border border-border-subtle mb-6">
              <div className="px-4 py-3 border-b border-border-subtle flex items-center justify-between">
                <h2 className="text-lg font-semibold text-text-main">数据表与视图</h2>
                <Button variant="secondary" onClick={() => fetchTables(selectedDb.uuid)} className="text-sm px-3 py-1">
                  刷新
                </Button>
              </div>
              {tablesLoading ? (
                <LoadingBlock label="加载数据表" rows={2} />
              ) : tables.length === 0 && views.length === 0 && indexes.length === 0 && triggers.length === 0 ? (
                <EmptyState title="暂无数据表" description="执行 CREATE TABLE 后即可在此看到数据表" />
              ) : (
                <div className="divide-y divide-border-subtle">
                  {[
                    { label: '表', items: tables },
                    { label: '视图', items: views },
                    { label: '索引', items: indexes },
                    { label: '触发器', items: triggers },
                  ]
                    .filter((group) => group.items.length > 0)
                    .map((group) => (
                      <div key={group.label}>
                        <p className="px-4 py-2 text-xs text-text-faint uppercase tracking-wide">
                          {group.label}（{group.items.length}）
                        </p>
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-border-subtle">
                                <th className="text-left py-2 px-4 text-sm font-medium text-text-muted">名称</th>
                                <th className="text-left py-2 px-4 text-sm font-medium text-text-muted">归属表</th>
                                <th className="text-right py-2 px-4 text-sm font-medium text-text-muted">操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.items.map((obj) => (
                                <tr key={obj.name} className="border-b border-border-subtle/50 hover:bg-surface-3/30 transition-colors">
                                  <td className="py-2 px-4">
                                    <span className="text-text-main font-mono text-sm">{obj.name}</span>
                                  </td>
                                  <td className="py-2 px-4 text-sm text-text-muted">
                                    {obj.tbl_name || '—'}
                                  </td>
                                  <td className="py-2 px-4 text-right">
                                    {group.label === '表' && (
                                      <Button
                                        variant="secondary"
                                        onClick={() => setSqlQuery(`SELECT * FROM ${obj.name} LIMIT 100;`)}
                                        className="text-sm px-3 py-1"
                                      >
                                        查询
                                      </Button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* SQL Query Editor */}
            <div className="bg-surface-2 rounded-xl shadow-lg border border-border-subtle">
              <div className="px-4 py-3 border-b border-border-subtle">
                <h2 className="text-lg font-semibold text-text-main">SQL 控制台</h2>
              </div>
              <div className="p-4">
                <textarea
                  ref={textareaRef}
                  className="w-full px-3 py-2 bg-surface border border-border-strong rounded-lg text-text-main placeholder-text-faint focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent h-32 font-mono text-sm resize-y"
                  placeholder="输入 SQL 查询……（例如 SELECT * FROM my_table）"
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault()
                      handleExecuteQuery()
                    }
                  }}
                />
                <div className="mt-3">
                  <label className="block text-sm font-medium text-text-muted mb-1">
                    绑定参数（每行一个，按 ? 占位符顺序）
                  </label>
                  <textarea
                    className="w-full px-3 py-2 bg-surface border border-border-strong rounded-lg text-text-main placeholder-text-faint focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent h-16 font-mono text-sm resize-y"
                    placeholder={'参数示例：\n100\n\'hello\'\ntrue'}
                    value={sqlParams}
                    onChange={(e) => setSqlParams(e.target.value)}
                  />
                </div>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-xs text-text-faint">按 Ctrl+Enter 执行</p>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={runExplain} disabled={!sqlQuery.trim()} className="text-sm px-3 py-1">
                      EXPLAIN
                    </Button>
                    <Button onClick={handleExecuteQuery} loading={queryLoading} disabled={!sqlQuery.trim()}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                      </svg>
                      执行
                    </Button>
                  </div>
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
                  <div className="px-4 py-2 border-b border-border-subtle flex flex-wrap items-center gap-4 text-xs text-text-muted">
                    {queryResults.meta && (
                      <>
                        {queryResults.meta.duration != null && <span>耗时：{queryResults.meta.duration.toFixed(2)}ms</span>}
                        {queryResults.meta.rows_read != null && <span>读取行数：{queryResults.meta.rows_read}</span>}
                        {queryResults.meta.rows_written != null && <span>写入行数：{queryResults.meta.rows_written}</span>}
                        {queryResults.meta.changes != null && <span>变更行数：{queryResults.meta.changes}</span>}
                      </>
                    )}
                    {queryResults.results && queryResults.results.length > 0 && (
                      <button
                        type="button"
                        onClick={exportCsv}
                        className="ml-auto text-xs text-cf-orange hover:text-cf-orange/80 font-medium"
                      >
                        导出 CSV
                      </button>
                    )}
                  </div>
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
                        {queryResults.success ? '查询执行成功（无返回结果）' : '查询失败'}
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
            <PageHeader
              title="D1 数据库"
              description="管理当前账户下的 D1 数据库"
              actions={
                <Button onClick={() => setShowCreateModal(true)}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  创建数据库
                </Button>
              }
            />

            <ErrorBanner error={error} onDismiss={() => setError('')} />

            <div className="bg-surface-2 rounded-xl shadow-lg border border-border-subtle">
              <DataTable
                columns={databaseColumns}
                rows={databases}
                rowKey={(db) => db.uuid}
                onRowClick={openDatabase}
                loading={loading}
                searchPlaceholder="搜索数据库"
                pageSize={20}
                emptyTitle="还没有 D1 数据库"
                emptyDescription="创建数据库后即可执行 SQL 建表与查询"
                emptyIcon="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
              />
            </div>
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
      setError(err instanceof Error ? err.message : '创建数据库失败')
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
    <Modal open title="创建 D1 数据库" onClose={handleClose} closable={!loading} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="db-name"
          label="数据库名称"
          placeholder="my-database"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading} className="flex-1">
            取消
          </Button>
          <Button type="submit" loading={loading} disabled={!name} className="flex-1">
            创建
          </Button>
        </div>
      </form>
    </Modal>
  )
}
