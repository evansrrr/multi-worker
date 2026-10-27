import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import ErrorBanner from '../../components/ui/ErrorBanner'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import Modal from '../../components/ui/Modal'
import DataTable, { DataTableColumn } from '../../components/ui/DataTable'
import PageHeader from '../../components/ui/PageHeader'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'
import { formatDateTime } from '../../lib/datetime'
import { useToast } from '../../hooks/useToast'

/**
 * KV 键名的 URL 编码：键名可含 `/`，后端路由是 [[key]] 多段 catch-all，
 * 因此必须对每一段单独 encodeURIComponent 后再用 `/` 拼接。
 * 整体 encode 会把 `/` 也编码掉，导致 CF 侧拿到错误的键名。
 */
function encodeKey(name: string): string {
  return name.split('/').map((seg) => encodeURIComponent(seg)).join('/')
}

/** 键列表走 cursor 分页，DataTable 只承担搜索与排序，不再切页 */
const KEYS_PAGE_SIZE = 1000

interface KvNamespace {
  id: string
  title: string
  created_on: string
  modified_on: string
  description?: string
}

interface KvKey {
  name: string
  expiration?: number
  metadata?: Record<string, string>
}

export default function KV() {
  const { accountId, namespaceId } = useParams()
  const navigate = useNavigate()
  const [namespaces, setNamespaces] = useState<KvNamespace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // 选中态入 URL（H9）：/accounts/:accountId/kv/:namespaceId
  // selectedNamespace 由 URL 派生，刷新/分享/后退都能保持上下文
  const selectedNamespace = namespaceId
    ? namespaces.find((n) => n.id === namespaceId) ?? null
    : null

  const openNamespace = (ns: KvNamespace) =>
    navigate(`/accounts/${accountId}/kv/${encodeURIComponent(ns.id)}`)
  const closeNamespace = () => navigate(`/accounts/${accountId}/kv`)

  const [keys, setKeys] = useState<KvKey[]>([])
  const [keysLoading, setKeysLoading] = useState(false)
  const [keysCursor, setKeysCursor] = useState<string | null>(null)
  const [keysComplete, setKeysComplete] = useState(false)
  const [keysPrefix, setKeysPrefix] = useState('')

  // Key editor state
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [editingKey, setEditingKey] = useState<KvKey | null>(null)
  const [keyName, setKeyName] = useState('')
  const [keyValue, setKeyValue] = useState('')
  const [keyExpiration, setKeyExpiration] = useState('')
  const [keyError, setKeyError] = useState('')
  const [keySaving, setKeySaving] = useState(false)
  const [deletingKeyName, setDeletingKeyName] = useState<string | null>(null)
  const [viewingKey, setViewingKey] = useState<{ name: string; value: string } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<
    | { kind: 'namespace'; ns: KvNamespace }
    | { kind: 'key'; name: string }
    | null
  >(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const { addToast } = useToast()

  const fetchNamespaces = useCallback(async () => {
    try {
      const data = await apiGet<{ namespaces?: KvNamespace[] }>(`/api/accounts/${accountId}/kv`)
      setNamespaces(data.namespaces || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 KV 命名空间失败')
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    fetchNamespaces()
  }, [fetchNamespaces])

  const fetchKeys = useCallback(
    async (namespaceId: string, cursor?: string) => {
      setKeysLoading(true)
      try {
        let url = `/api/accounts/${accountId}/kv/${namespaceId}/keys?limit=100`
        // prefix 与 cursor 的关系：cursor 不携带 prefix，翻页时每页都必须带同一个
        // prefix，否则后续页会退化成全量列表。
        if (keysPrefix) url += `&prefix=${encodeURIComponent(keysPrefix)}`
        if (cursor) url += `&cursor=${cursor}`
        const data = await apiGet<{
          keys?: KvKey[]
          cursor?: string
          list_complete?: boolean
        }>(url)
        if (cursor) {
          setKeys((prev) => [...prev, ...(data.keys || [])])
        } else {
          setKeys(data.keys || [])
        }
        setKeysComplete(data.list_complete ?? true)
        setKeysCursor(data.cursor || null)
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载键列表失败')
      } finally {
        setKeysLoading(false)
      }
    },
    [accountId, keysPrefix]
  )

  useEffect(() => {
    if (namespaceId) {
      fetchKeys(namespaceId)
    }
  }, [namespaceId, fetchKeys])

  const handleCreateNamespace = async (title: string) => {
    // silent: 创建弹窗内联展示表单错误
    const data = await apiPost<{ namespace?: KvNamespace }>(
      `/api/accounts/${accountId}/kv`,
      { title },
      { silent: true }
    )
    if (data.namespace) {
      const created = data.namespace
      setNamespaces((prev) => [...prev, created])
    }
    addToast('命名空间创建成功', 'success')
  }

  const handleDeleteNamespace = async (ns: KvNamespace) => {
    setDeletingId(ns.id)
    setConfirmLoading(true)
    try {
      await apiDelete(`/api/accounts/${accountId}/kv/${ns.id}`)
      addToast('删除成功', 'success')
      setNamespaces((prev) => prev.filter((n) => n.id !== ns.id))
      // 删除的正是当前打开的命名空间时回列表（URL 已失效）
      if (selectedNamespace?.id === ns.id) {
        setKeys([])
        closeNamespace()
      }
      setDeleteTarget(null)
    } catch {
      // api 已自动弹出错误 toast，此处仅收尾
    } finally {
      setDeletingId(null)
      setConfirmLoading(false)
    }
  }

  const handleSaveKey = async () => {
    if (!selectedNamespace) return
    setKeyError('')
    const trimmedName = keyName.trim()
    if (!trimmedName) {
      setKeyError('键名不能为空')
      return
    }
    setKeySaving(true)
    try {
      const body: Record<string, unknown> = { value: keyValue }
      if (keyExpiration) {
        const ttl = parseInt(keyExpiration, 10)
        if (!isNaN(ttl) && ttl > 0) {
          body.expiration_ttl = ttl
        }
      }
      // silent: 键编辑弹窗内联 keyError 展示
      await apiPut(
        `/api/accounts/${accountId}/kv/${selectedNamespace.id}/keys/${encodeKey(trimmedName)}`,
        body,
        { silent: true }
      )
      addToast('保存成功', 'success')
      setShowKeyModal(false)
      fetchKeys(selectedNamespace.id)
    } catch (err) {
      setKeyError(err instanceof Error ? err.message : '保存键失败')
    } finally {
      setKeySaving(false)
    }
  }

  const handleDeleteKey = async (targetName: string) => {
    if (!selectedNamespace) return
    setDeletingKeyName(targetName)
    setConfirmLoading(true)
    try {
      await apiDelete(
        `/api/accounts/${accountId}/kv/${selectedNamespace.id}/keys/${encodeKey(targetName)}`
      )
      addToast('删除成功', 'success')
      setDeleteTarget(null)
      fetchKeys(selectedNamespace.id)
    } catch {
      // api 已自动弹出错误 toast，此处仅收尾
    } finally {
      setDeletingKeyName(null)
      setConfirmLoading(false)
    }
  }

  const fetchKeyValue = async (targetName: string): Promise<string | null> => {
    if (!selectedNamespace) return null
    try {
      const data = await apiGet<{ key: string; value: string }>(
        `/api/accounts/${accountId}/kv/${selectedNamespace.id}/keys/${encodeKey(targetName)}`
      )
      return data.value
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取键值失败')
      return null
    }
  }

  const handleViewKey = async (targetName: string) => {
    const value = await fetchKeyValue(targetName)
    if (value !== null) {
      setViewingKey({ name: targetName, value })
    }
  }

  /** 导出整个命名空间的键值对为 JSON 并触发下载。 */
  const handleExport = async () => {
    if (!selectedNamespace) return
    try {
      const data = await apiGet<{
        truncated?: boolean
        items?: Array<Record<string, unknown>>
      }>(`/api/accounts/${accountId}/kv/${selectedNamespace.id}/export`)
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `kv-export-${selectedNamespace.title}.json`
      a.click()
      URL.revokeObjectURL(url)
      addToast(data.truncated ? '导出成功（已截断，可用 prefix 分批导出）' : '导出成功', 'success')
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败')
    }
  }

  const keyColumns: DataTableColumn<KvKey>[] = [
    {
      key: 'name',
      header: '键名',
      value: (key) => key.name,
      sortable: true,
      render: (key) => <span className="text-text-main font-mono">{key.name}</span>,
    },
    {
      key: 'metadata',
      header: '元数据',
      value: (key) => (key.metadata ? JSON.stringify(key.metadata) : ''),
      render: (key) =>
        key.metadata && Object.keys(key.metadata).length > 0 ? (
          <span className="font-mono text-xs text-text-muted">{JSON.stringify(key.metadata)}</span>
        ) : (
          <span className="text-text-faint">—</span>
        ),
    },
    {
      key: 'expiration',
      header: '过期时间',
      value: (key) => (key.expiration ? formatDateTime(key.expiration * 1000) : ''),
      sortable: true,
      render: (key) => (
        <span className="text-text-muted">
          {key.expiration ? formatDateTime(key.expiration * 1000) : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      stopRowClick: true,
      searchable: false,
      render: (key) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => handleViewKey(key.name)}
            className="text-sm px-3 py-1"
          >
            查看
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setEditingKey(key)
              setKeyName(key.name)
              setKeyValue('')
              setKeyExpiration('')
              setKeyError('')
              setShowKeyModal(true)
              // M11: 副作用放在 updater 之外，setViewingKey 保持纯函数
              fetchKeyValue(key.name).then((value) => {
                if (value !== null) {
                  setKeyValue(value)
                  setViewingKey(null)
                }
              })
            }}
            className="text-sm px-3 py-1"
          >
            编辑
          </Button>
          <Button
            variant="danger"
            onClick={() => setDeleteTarget({ kind: 'key', name: key.name })}
            loading={deletingKeyName === key.name}
            className="text-sm px-3 py-1"
          >
            删除
          </Button>
        </div>
      ),
    },
  ]

  const namespaceColumns: DataTableColumn<KvNamespace>[] = [
    {
      key: 'name',
      header: '名称',
      value: (ns) => ns.title,
      sortable: true,
      render: (ns) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cf-orange/10 flex items-center justify-center shrink-0">
            <svg
              className="w-4 h-4 text-cf-orange"
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
          <span className="text-text-main font-medium">{ns.title}</span>
        </div>
      ),
    },
    {
      key: 'id',
      header: 'ID',
      value: (ns) => ns.id,
      render: (ns) => <span className="font-mono text-text-muted">{ns.id}</span>,
    },
    {
      key: 'created',
      header: '创建时间',
      value: (ns) => formatDateTime(ns.created_on),
      sortable: true,
      render: (ns) => <span className="text-text-muted">{formatDateTime(ns.created_on)}</span>,
    },
    {
      key: 'modified',
      header: '修改时间',
      value: (ns) => formatDateTime(ns.modified_on),
      sortable: true,
      render: (ns) => <span className="text-text-muted">{formatDateTime(ns.modified_on)}</span>,
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      stopRowClick: true,
      searchable: false,
      render: (ns) => (
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => openNamespace(ns)} className="text-sm px-3 py-1">
            浏览键
          </Button>
          <Button
            variant="danger"
            onClick={() => setDeleteTarget({ kind: 'namespace', ns })}
            loading={deletingId === ns.id}
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
      {selectedNamespace ? (
          /* Key browser view */
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <button
                  onClick={closeNamespace}
                  className="text-sm text-text-muted hover:text-text-main mb-2 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  返回命名空间列表
                </button>
                <h1 className="text-3xl font-bold text-cf-orange">{selectedNamespace.title}</h1>
                <p className="text-text-muted mt-1">该命名空间下的键</p>
              </div>
              <Button
                onClick={() => {
                  setEditingKey(null)
                  setKeyName('')
                  setKeyValue('')
                  setKeyExpiration('')
                  setKeyError('')
                  setShowKeyModal(true)
                }}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                新建键
              </Button>
            </div>

            <ErrorBanner error={error} onDismiss={() => setError('')} />

            <div className="bg-surface-2 rounded-xl shadow-lg border border-border-subtle">
              <DataTable
                columns={keyColumns}
                rows={keys}
                rowKey={(key) => key.name}
                // 只有首屏加载才整表占位；"加载更多"时保留已加载的行
                loading={keysLoading && keys.length === 0}
                searchPlaceholder="搜索键名"
                pageSize={KEYS_PAGE_SIZE}
                emptyTitle="这个命名空间下还没有键"
                emptyDescription="点击右上角「新建键」写入第一个键值对"
                emptyIcon="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z"
                toolbar={
                  <>
                    <input
                      type="search"
                      value={keysPrefix}
                      onChange={(e) => setKeysPrefix(e.target.value)}
                      placeholder="按前缀过滤（服务端）"
                      aria-label="按前缀过滤键"
                      className="w-56 px-3 py-1.5 text-sm bg-surface-3 border border-border-strong rounded-lg text-text-main placeholder-text-faint focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent"
                    />
                    <Button variant="secondary" onClick={handleExport} className="text-sm px-3 py-1">
                      导出 JSON
                    </Button>
                  </>
                }
              />
              {!keysComplete && keys.length > 0 && (
                <div className="p-4 border-t border-border-subtle">
                  <Button
                    variant="secondary"
                    onClick={() => keysCursor && fetchKeys(selectedNamespace.id, keysCursor)}
                    loading={keysLoading}
                    className="w-full"
                  >
                    加载更多
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Namespace list view */
          <div>
            <PageHeader
              title="KV 命名空间"
              description="管理当前账户下的 KV 命名空间"
              actions={
                <Button onClick={() => setShowCreateModal(true)}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  创建命名空间
                </Button>
              }
            />

            <ErrorBanner error={error} onDismiss={() => setError('')} />

            <div className="bg-surface-2 rounded-xl shadow-lg border border-border-subtle">
              <DataTable
                columns={namespaceColumns}
                rows={namespaces}
                rowKey={(ns) => ns.id}
                onRowClick={openNamespace}
                loading={loading}
                searchPlaceholder="搜索命名空间"
                pageSize={20}
                emptyTitle="还没有 KV 命名空间"
                emptyDescription="创建命名空间后即可在其中读写键值对"
                emptyIcon="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125"
              />
            </div>
          </div>
        )}

        {/* Create Namespace Modal */}
        {showCreateModal && (
          <CreateNamespaceModal
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateNamespace}
          />
        )}

        {/* Edit/Create Key Modal */}
        <Modal
          open={showKeyModal && !!selectedNamespace}
          title={editingKey ? `编辑键：${editingKey.name}` : '新建键'}
          onClose={() => setShowKeyModal(false)}
          closable={!keySaving}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4">
                <Input
                  id="key-name"
                  label="键名"
                  placeholder="my-key"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  disabled={!!editingKey}
                />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-text-main">值</label>
                  <textarea
                    className="w-full px-3 py-2 bg-surface-2 border border-border-strong rounded-lg text-text-main placeholder-text-faint focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent h-32 font-mono text-sm resize-y"
                    placeholder="输入键值……"
                    value={keyValue}
                    onChange={(e) => setKeyValue(e.target.value)}
                    autoFocus
                  />
                </div>
                <Input
                  id="key-expiration"
                  label="过期 TTL（秒，可选）"
                  placeholder="例如 3600"
                  type="number"
                  value={keyExpiration}
                  onChange={(e) => setKeyExpiration(e.target.value)}
                />
                {keyError && <p className="text-sm text-red-500">{keyError}</p>}
                <div className="flex gap-3 pt-2">
                  <Button variant="secondary" onClick={() => setShowKeyModal(false)} disabled={keySaving} className="flex-1">
                    取消
                  </Button>
                  <Button onClick={handleSaveKey} loading={keySaving} disabled={!keyValue} className="flex-1">
                    保存
                  </Button>
                </div>
              </div>
        </Modal>

        {/* View Key Modal */}
        <Modal
          open={!!viewingKey}
          title={viewingKey ? `键：${viewingKey.name}` : ''}
          onClose={() => setViewingKey(null)}
          maxWidth="max-w-lg"
        >
          {viewingKey && (
            <>
              <div className="bg-surface rounded-lg p-4 border border-border-subtle">
                <pre className="text-sm text-text-main whitespace-pre-wrap break-all font-mono overflow-auto max-h-96">
                  {viewingKey.value}
                </pre>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="secondary" onClick={() => setViewingKey(null)} className="flex-1">关闭</Button>
                <Button
                  onClick={() => {
                    setEditingKey({ name: viewingKey.name })
                    setKeyName(viewingKey.name)
                    setKeyValue(viewingKey.value)
                    setKeyExpiration('')
                    setKeyError('')
                    setViewingKey(null)
                    setShowKeyModal(true)
                  }}
                  className="flex-1"
                >
                  编辑
                </Button>
              </div>
            </>
          )}
        </Modal>
        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={deleteTarget !== null}
          title={deleteTarget?.kind === 'namespace' ? '删除命名空间' : '删除键'}
          message={
            deleteTarget?.kind === 'namespace'
              ? `确定要删除命名空间 "${deleteTarget.ns.title}" 吗？此操作不可撤销。`
              : deleteTarget?.kind === 'key'
                ? `确定要删除键 "${deleteTarget.name}" 吗？此操作不可撤销。`
                : ''
          }
          confirmText="删除"
          danger
          requireName={
            deleteTarget?.kind === 'namespace'
              ? deleteTarget.ns.title
              : deleteTarget?.kind === 'key'
                ? deleteTarget.name
                : undefined
          }
          loading={confirmLoading}
          onConfirm={() => {
            if (!deleteTarget) return
            if (deleteTarget.kind === 'namespace') {
              handleDeleteNamespace(deleteTarget.ns)
            } else {
              handleDeleteKey(deleteTarget.name)
            }
          }}
          onClose={() => setDeleteTarget(null)}
        />
    </div>
  )
}

function CreateNamespaceModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (title: string) => Promise<void>
}) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await onCreate(title)
      setTitle('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建命名空间失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setTitle('')
      setError('')
      onClose()
    }
  }

  return (
    <Modal open title="创建 KV 命名空间" onClose={handleClose} closable={!loading} maxWidth="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="ns-title"
          label="命名空间名称"
          placeholder="my-namespace"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={loading} className="flex-1">
            取消
          </Button>
          <Button type="submit" loading={loading} disabled={!title} className="flex-1">
            创建
          </Button>
        </div>
      </form>
    </Modal>
  )
}
