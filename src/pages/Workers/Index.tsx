import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import WorkerTable from '../../components/workers/WorkerTable'
import CreateWorkerModal from '../../components/workers/CreateWorkerModal'
import BindingsEditor from '../../components/workers/BindingsEditor'
import WorkerDeployModal from '../../components/workers/WorkerDeployModal'
import Button from '../../components/ui/Button'
import ErrorBanner from '../../components/ui/ErrorBanner'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../hooks/useToast'
import { api, apiDelete, apiGet, apiPost } from '../../lib/api'

interface Worker {
  id: string
  name: string
  created_on: string
  updated_on: string
  deployed_on?: string
  routes?: Array<{
    pattern: string
    zone_id: string
    zone_name: string
    priority: number
  }>
}

interface ResultInfo {
  count?: number
  page?: number
  per_page?: number
  total_count?: number
}

interface WorkersResponse {
  workers?: Worker[]
  result_info?: ResultInfo | null
}

export default function Workers() {
  const { accountId } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deletingName, setDeletingName] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [bindingsWorkerName, setBindingsWorkerName] = useState<string | null>(null)
  const [deployWorkerName, setDeployWorkerName] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [resultInfo, setResultInfo] = useState<ResultInfo | null>(null)

  const PER_PAGE = 20

  const fetchWorkers = async (nextPage = 1, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const data = await apiGet<WorkersResponse>(
        `/api/accounts/${accountId}/workers?page=${nextPage}&per_page=${PER_PAGE}`
      )

      const incoming: Worker[] = data.workers || []
      setWorkers((prev) => (append ? [...prev, ...incoming] : incoming))
      setResultInfo(data.result_info || null)
      setPage(nextPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 Worker 列表失败')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchWorkers(1, false)
  }, [accountId])

  const hasMore = resultInfo
    ? (resultInfo.page ?? 1) * (resultInfo.per_page ?? PER_PAGE) < (resultInfo.total_count ?? 0)
    : false

  const handleCreateWorker = async (name: string, script?: string) => {
    // 创建失败由 CreateWorkerModal 内联展示，故 silent
    const data = await apiPost<{ worker?: Worker }>(
      `/api/accounts/${accountId}/workers`,
      { name, script },
      { silent: true }
    )

    const worker = data.worker
    if (worker) {
      setWorkers((prev) => [...prev, worker])
    }
    addToast('Worker 已创建', 'success')
  }

  const handleDeleteWorker = (name: string) => {
    setDeleteTarget(name)
  }

  const performDeleteWorker = async () => {
    const name = deleteTarget
    if (!name) return

    setDeletingName(name)
    try {
      await apiDelete(`/api/accounts/${accountId}/workers/${name}`)
      setWorkers((prev) => prev.filter((w) => w.name !== name))
      addToast('Worker 已删除', 'success')
      setDeleteTarget(null)
    } catch {
      // 错误已由 api 自动 toast，此处仅收尾；弹窗保持打开以便重试
    } finally {
      setDeletingName(null)
    }
  }

  const handleDeployWorker = async (name: string, files: File[]) => {
    const formData = new FormData()
    files.forEach((file) => {
      formData.append('files', file)
    })

    // 部署失败由 WorkerDeployModal 内联展示，故 silent
    await api(`/api/accounts/${accountId}/workers/${name}/deploy`, {
      method: 'POST',
      body: formData,
      silent: true,
    })
    addToast('部署成功', 'success')
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-cf-orange">Workers</h1>
          <p className="text-text-muted mt-1">Manage workers for this account</p>
        </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Create Worker
          </Button>
        </div>

        <ErrorBanner error={error} onDismiss={() => setError('')} />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-cf-orange border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="bg-surface-2 rounded-xl shadow-lg border border-border-subtle">
            <WorkerTable
              workers={workers}
              onDelete={handleDeleteWorker}
              onManageBindings={(name) => setBindingsWorkerName(name)}
              onDeploy={(name) => setDeployWorkerName(name)}
              onRowClick={(name) =>
                navigate(`/accounts/${accountId}/workers/${encodeURIComponent(name)}`)
              }
              deletingName={deletingName}
            />
            {hasMore && (
              <div className="p-4 border-t border-border-subtle">
                <Button
                  variant="secondary"
                  onClick={() => fetchWorkers(page + 1, true)}
                  loading={loadingMore}
                  className="w-full"
                >
                  Load More
                </Button>
              </div>
            )}
          </div>
        )}

      <CreateWorkerModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateWorker}
      />

      {bindingsWorkerName && accountId && (
        <BindingsEditor
          accountId={accountId}
          workerName={bindingsWorkerName}
          onClose={() => setBindingsWorkerName(null)}
        />
      )}

      {deployWorkerName && accountId && (
        <WorkerDeployModal
          open={!!deployWorkerName}
          workerName={deployWorkerName}
          onClose={() => setDeployWorkerName(null)}
          onDeploy={handleDeployWorker}
        />
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除 Worker"
        message={
          <>
            确定要删除 Worker <span className="font-mono text-cf-orange">{deleteTarget}</span> 吗？
            该操作不可恢复。
          </>
        }
        confirmText="删除"
        danger
        requireName={deleteTarget ?? undefined}
        loading={!!deleteTarget && deletingName === deleteTarget}
        onConfirm={performDeleteWorker}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
