import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import WorkerTable from '../../components/workers/WorkerTable'
import CreateWorkerModal from '../../components/workers/CreateWorkerModal'
import BindingsEditor from '../../components/workers/BindingsEditor'
import WorkerDeployModal from '../../components/workers/WorkerDeployModal'
import Button from '../../components/ui/Button'
import ErrorBanner from '../../components/ui/ErrorBanner'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import LoadingBlock from '../../components/ui/LoadingBlock'
import PageHeader from '../../components/ui/PageHeader'
import { useToast } from '../../hooks/useToast'
import { api, apiDelete, apiGet, apiPost } from '../../lib/api'

interface Worker {
  id: string
  name: string
  created_on?: string
  updated_on?: string
  routes?: Array<{ id?: string; pattern?: string; script?: string }>
}

interface WorkersResponse {
  workers?: Worker[]
}

export default function Workers() {
  const { accountId } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deletingName, setDeletingName] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [bindingsWorkerName, setBindingsWorkerName] = useState<string | null>(null)
  const [deployWorkerName, setDeployWorkerName] = useState<string | null>(null)

  // 经典 /workers/scripts 不支持分页，后端一次返回全部脚本；分页、搜索、排序
  // 都由 WorkerTable 内部的 DataTable 在客户端完成。
  const fetchWorkers = async () => {
    setLoading(true)
    try {
      const data = await apiGet<WorkersResponse>(`/api/accounts/${accountId}/workers`)
      setWorkers(data.workers || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 Worker 列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkers()
  }, [accountId])

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
      <PageHeader
        title="Workers"
        description="管理当前账户下的 Worker"
        actions={
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
            创建 Worker
          </Button>
        }
      />

        <ErrorBanner error={error} onDismiss={() => setError('')} />

        {loading ? (
          <div className="bg-surface-2 rounded-xl shadow-lg border border-border-subtle">
            <LoadingBlock label="正在加载 Worker 列表" />
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
