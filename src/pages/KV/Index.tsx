import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import ErrorBanner from '../../components/ui/ErrorBanner'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

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
  const { accountId } = useParams()
  const [namespaces, setNamespaces] = useState<KvNamespace[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Key browsing state
  const [selectedNamespace, setSelectedNamespace] = useState<KvNamespace | null>(null)
  const [keys, setKeys] = useState<KvKey[]>([])
  const [keysLoading, setKeysLoading] = useState(false)
  const [keysCursor, setKeysCursor] = useState<string | null>(null)
  const [keysComplete, setKeysComplete] = useState(false)

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
    [accountId]
  )

  useEffect(() => {
    if (selectedNamespace) {
      fetchKeys(selectedNamespace.id)
    }
  }, [selectedNamespace, fetchKeys])

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
      if (selectedNamespace?.id === ns.id) {
        setSelectedNamespace(null)
        setKeys([])
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
        `/api/accounts/${accountId}/kv/${selectedNamespace.id}/keys/${encodeURIComponent(trimmedName)}`,
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
        `/api/accounts/${accountId}/kv/${selectedNamespace.id}/keys/${encodeURIComponent(targetName)}`
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
        `/api/accounts/${accountId}/kv/${selectedNamespace.id}/keys/${encodeURIComponent(targetName)}`
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

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {selectedNamespace ? (
          /* Key browser view */
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <button
                  onClick={() => { setSelectedNamespace(null); setKeys([]) }}
                  className="text-sm text-gray-400 hover:text-white mb-2 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Back to Namespaces
                </button>
                <h1 className="text-3xl font-bold text-cf-orange">{selectedNamespace.title}</h1>
                <p className="text-gray-400 mt-1">Keys in this namespace</p>
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
                Add Key
              </Button>
            </div>

            <ErrorBanner error={error} onDismiss={() => setError('')} />

            <div className="bg-cf-dark-800 rounded-xl shadow-lg border border-cf-dark-700">
              {keys.length === 0 && !keysLoading ? (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 text-gray-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
                  </svg>
                  <p className="text-gray-400">No keys found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-cf-dark-700">
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Key</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Metadata</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Expiration</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keys.map((key) => (
                        <tr key={key.name} className="border-b border-cf-dark-700/50 hover:bg-cf-dark-700/30 transition-colors">
                          <td className="py-3 px-4">
                            <span className="text-white font-mono text-sm">{key.name}</span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-400">
                            {key.metadata && Object.keys(key.metadata).length > 0
                              ? <span className="font-mono text-xs">{JSON.stringify(key.metadata)}</span>
                              : '—'}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-400">
                            {key.expiration ? new Date(key.expiration * 1000).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button variant="secondary" onClick={() => handleViewKey(key.name)} className="text-sm px-3 py-1">
                                View
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
                                Edit
                              </Button>
                              <Button
                                variant="danger"
                                onClick={() => setDeleteTarget({ kind: 'key', name: key.name })}
                                loading={deletingKeyName === key.name}
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
              {!keysComplete && keys.length > 0 && (
                <div className="p-4 border-t border-cf-dark-700">
                  <Button
                    variant="secondary"
                    onClick={() => keysCursor && fetchKeys(selectedNamespace.id, keysCursor)}
                    loading={keysLoading}
                    className="w-full"
                  >
                    Load More
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Namespace list view */
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-cf-orange">KV Namespaces</h1>
                <p className="text-gray-400 mt-1">Manage KV namespaces for this account</p>
              </div>
              <Button onClick={() => setShowCreateModal(true)}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Create Namespace
              </Button>
            </div>

            <ErrorBanner error={error} onDismiss={() => setError('')} />

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <div className="animate-spin h-8 w-8 border-4 border-cf-orange border-t-transparent rounded-full" />
              </div>
            ) : (
              <div className="bg-cf-dark-800 rounded-xl shadow-lg border border-cf-dark-700">
                {namespaces.length === 0 ? (
                  <div className="text-center py-12">
                    <svg className="w-12 h-12 text-gray-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                    </svg>
                    <p className="text-gray-400">No KV namespaces found</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-cf-dark-700">
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Name</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">ID</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Created</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Modified</th>
                          <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {namespaces.map((ns) => (
                          <tr key={ns.id} className="border-b border-cf-dark-700/50 hover:bg-cf-dark-700/30 transition-colors">
                            <td className="py-3 px-4">
                              <button
                                onClick={() => setSelectedNamespace(ns)}
                                className="flex items-center gap-3 text-left hover:opacity-80"
                              >
                                <div className="w-8 h-8 rounded-lg bg-cf-orange/10 flex items-center justify-center">
                                  <svg className="w-4 h-4 text-cf-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                                  </svg>
                                </div>
                                <span className="text-white font-medium">{ns.title}</span>
                              </button>
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-400 font-mono">{ns.id}</td>
                            <td className="py-3 px-4 text-sm text-gray-400">{formatDate(ns.created_on)}</td>
                            <td className="py-3 px-4 text-sm text-gray-400">{formatDate(ns.modified_on)}</td>
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="secondary" onClick={() => setSelectedNamespace(ns)} className="text-sm px-3 py-1">
                                  Browse Keys
                                </Button>
                                <Button
                                  variant="danger"
                                  onClick={() => setDeleteTarget({ kind: 'namespace', ns })}
                                  loading={deletingId === ns.id}
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

        {/* Create Namespace Modal */}
        {showCreateModal && (
          <CreateNamespaceModal
            onClose={() => setShowCreateModal(false)}
            onCreate={handleCreateNamespace}
          />
        )}

        {/* Edit/Create Key Modal */}
        {showKeyModal && selectedNamespace && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !keySaving && setShowKeyModal(false)} />
            <div className="relative bg-cf-dark-800 rounded-xl p-6 w-full max-w-lg shadow-2xl border border-cf-dark-700 mx-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  {editingKey ? `Edit Key: ${editingKey.name}` : 'Add Key'}
                </h2>
                <button onClick={() => !keySaving && setShowKeyModal(false)} className="text-gray-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <Input
                  id="key-name"
                  label="Key Name"
                  placeholder="my-key"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  disabled={!!editingKey}
                />
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-300">Value</label>
                  <textarea
                    className="w-full px-3 py-2 bg-cf-dark-800 border border-cf-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent h-32 font-mono text-sm resize-y"
                    placeholder="Enter value..."
                    value={keyValue}
                    onChange={(e) => setKeyValue(e.target.value)}
                    autoFocus
                  />
                </div>
                <Input
                  id="key-expiration"
                  label="Expiration TTL (seconds, optional)"
                  placeholder="e.g. 3600"
                  type="number"
                  value={keyExpiration}
                  onChange={(e) => setKeyExpiration(e.target.value)}
                />
                {keyError && <p className="text-sm text-red-500">{keyError}</p>}
                <div className="flex gap-3 pt-2">
                  <Button variant="secondary" onClick={() => setShowKeyModal(false)} disabled={keySaving} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleSaveKey} loading={keySaving} disabled={!keyValue} className="flex-1">
                    Save Key
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Key Modal */}
        {viewingKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setViewingKey(null)} />
            <div className="relative bg-cf-dark-800 rounded-xl p-6 w-full max-w-lg shadow-2xl border border-cf-dark-700 mx-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">Key: {viewingKey.name}</h2>
                <button onClick={() => setViewingKey(null)} className="text-gray-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="bg-cf-dark-900 rounded-lg p-4 border border-cf-dark-700">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap break-all font-mono overflow-auto max-h-96">
                  {viewingKey.value}
                </pre>
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="secondary" onClick={() => setViewingKey(null)} className="flex-1">Close</Button>
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
                  Edit
                </Button>
              </div>
            </div>
          </div>
        )}
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
    </Layout>
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
      setError(err instanceof Error ? err.message : 'Failed to create namespace')
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-cf-dark-800 rounded-xl p-6 w-full max-w-lg shadow-2xl border border-cf-dark-700 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Create KV Namespace</h2>
          <button onClick={handleClose} disabled={loading} className="text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="ns-title"
            label="Namespace Title"
            placeholder="my-namespace"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={loading} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" loading={loading} disabled={!title} className="flex-1">
              Create Namespace
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
