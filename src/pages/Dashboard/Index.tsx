import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import ResourceTable from '../../components/dashboard/ResourceTable'
import BatchToolbar from '../../components/dashboard/BatchToolbar'
import BatchDeployModal from '../../components/dashboard/BatchDeployModal'
import ErrorBanner from '../../components/ui/ErrorBanner'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { apiGet, apiPost } from '../../lib/api'
import { useToast } from '../../hooks/useToast'
import { ResourceItem } from '../../types'

interface BatchResult {
  name: string
  success: boolean
  error?: string
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState('modifiedOn')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [batchLoading, setBatchLoading] = useState(false)
  const [showDeployModal, setShowDeployModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    fetchResources()
  }, [])

  const fetchResources = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiGet<{ resources?: ResourceItem[] }>('/api/resources')
      setResources(data.resources || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载资源列表失败')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const workers = resources.filter((r) => r.type === 'worker').length
    const pages = resources.filter((r) => r.type === 'pages').length
    return { workers, pages, total: resources.length }
  }, [resources])

  const sortedResources = useMemo(() => {
    const sorted = [...resources].sort((a, b) => {
      let valA: string
      let valB: string

      switch (sortField) {
        case 'name':
          valA = a.name.toLowerCase()
          valB = b.name.toLowerCase()
          break
        case 'type':
          valA = a.type
          valB = b.type
          break
        case 'accountName':
          valA = a.accountName.toLowerCase()
          valB = b.accountName.toLowerCase()
          break
        case 'modifiedOn':
        default:
          valA = a.modifiedOn
          valB = b.modifiedOn
          break
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1
      if (valA > valB) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return sorted
  }, [resources, sortField, sortDir])

  const handleSort = (field: string) => {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const handleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleSelectAll = () => {
    if (selected.size === sortedResources.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(sortedResources.map((r) => `${r.accountId}:${r.name}`)))
    }
  }

  const handleRowClick = (resource: ResourceItem) => {
    if (resource.type === 'worker') {
      navigate(`/accounts/${resource.accountId}/workers/${resource.name}`)
    } else {
      navigate(`/accounts/${resource.accountId}/pages/${resource.name}`)
    }
  }

  const selectedResources = useMemo(() => {
    return sortedResources.filter((r) => selected.has(`${r.accountId}:${r.name}`))
  }, [sortedResources, selected])

  /** 批量结果逐项汇总：整体成功 toast，部分失败把失败项名列进 ErrorBanner。 */
  const reportBatchResults = (results: BatchResult[], action: '删除' | '部署') => {
    const failures = results.filter((r) => !r.success)
    if (failures.length === 0) {
      addToast(`批量${action}成功`, 'success')
      return
    }
    setError(
      `批量${action}完成，${failures.length} 项失败：${failures.map((f) => f.name).join('、')}`
    )
  }

  const buildTargets = () =>
    selectedResources.map((r) => ({
      accountId: r.accountId,
      name: r.name,
      type: r.type,
    }))

  const runBatchDelete = async () => {
    if (selected.size === 0) return

    setBatchLoading(true)
    setError('')
    try {
      const data = await apiPost<{ results?: BatchResult[] }>('/api/batch/delete', {
        targets: buildTargets(),
      })
      if (data.results) {
        reportBatchResults(data.results, '删除')
      }
      setSelected(new Set())
      await fetchResources()
      setShowDeleteConfirm(false)
    } catch {
      // api() 已自动弹错误 toast；保持确认框打开以便重试
    } finally {
      setBatchLoading(false)
    }
  }

  const handleBatchDelete = () => {
    if (selected.size === 0) return
    setShowDeleteConfirm(true)
  }

  const handleBatchDeploy = async (file: File) => {
    setBatchLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('files', file)
      formData.append('targets', JSON.stringify(buildTargets()))

      const data = await apiPost<{ results?: BatchResult[] }>(
        '/api/batch/deploy',
        formData,
        // 由 BatchDeployModal 内联展示错误，关闭自动 toast 避免双份反馈
        { silent: true }
      )
      if (data.results) {
        reportBatchResults(data.results, '部署')
      }
      setSelected(new Set())
      await fetchResources()
    } finally {
      // 失败时错误向上抛回 BatchDeployModal 内联展示（无需 catch 再抛）
      setBatchLoading(false)
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-main mb-1">Dashboard</h1>
        <p className="text-text-muted">Overview of all your Cloudflare resources</p>
      </div>

      {/* Error banner */}
      <ErrorBanner error={error} onDismiss={() => setError('')} />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-2 rounded-xl p-4 border border-border-subtle">
          <p className="text-sm text-text-muted mb-1">Total Resources</p>
          <p className="text-2xl font-bold text-text-main">{stats.total}</p>
        </div>
        <div className="bg-surface-2 rounded-xl p-4 border border-border-subtle">
          <p className="text-sm text-text-muted mb-1">Workers</p>
          <p className="text-2xl font-bold text-blue-400">{stats.workers}</p>
        </div>
        <div className="bg-surface-2 rounded-xl p-4 border border-border-subtle">
          <p className="text-sm text-text-muted mb-1">Pages</p>
          <p className="text-2xl font-bold text-green-400">{stats.pages}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-2 rounded-xl border border-border-subtle">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin h-8 w-8 border-4 border-cf-orange border-t-transparent rounded-full" />
          </div>
        ) : (
          <ResourceTable
            resources={sortedResources}
            selected={selected}
            onSelect={handleSelect}
            onSelectAll={handleSelectAll}
            onRowClick={handleRowClick}
            sortField={sortField}
            sortDir={sortDir}
            onSort={handleSort}
          />
        )}
      </div>

      {/* Batch toolbar */}
      <BatchToolbar
        selectedCount={selected.size}
        onDelete={handleBatchDelete}
        onDeploy={() => setShowDeployModal(true)}
        loading={batchLoading}
      />

      {/* Batch delete confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="批量删除资源"
        message={
          <>
            将删除选中的 {selectedResources.length} 个资源：
            {selectedResources.map((r) => r.name).join('、')}。此操作不可恢复。
          </>
        }
        confirmText="删除"
        danger
        requireName="删除"
        loading={batchLoading}
        onConfirm={runBatchDelete}
        onClose={() => setShowDeleteConfirm(false)}
      />

      {/* Deploy modal */}
      <BatchDeployModal
        open={showDeployModal}
        targets={selectedResources}
        onClose={() => setShowDeployModal(false)}
        onDeploy={handleBatchDeploy}
      />
    </div>
  )
}
