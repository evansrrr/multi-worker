import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import ErrorBanner from '../../components/ui/ErrorBanner'
import { useToast } from '../../hooks/useToast'
import { api, apiGet } from '../../lib/api'
import LoadingBlock from '../../components/ui/LoadingBlock'
import { formatDateTime } from '../../lib/datetime'

interface WorkerDetail {
  id: string
  name: string
  created_on?: string
  /** 后端已把经典脚本的 modified_on 归一成 updated_on。 */
  updated_on?: string
  routes?: Array<{ id?: string; pattern?: string; script?: string }>
}

export default function WorkerDetail() {
  const { accountId, workerName } = useParams<{ accountId: string; workerName: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [worker, setWorker] = useState<WorkerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [deploySuccess, setDeploySuccess] = useState('')

  useEffect(() => {
    fetchWorker()
  }, [accountId, workerName])

  const fetchWorker = async () => {
    try {
      const data = await apiGet<{ worker?: WorkerDetail }>(
        `/api/accounts/${accountId}/workers/${workerName}`
      )
      setWorker(data.worker ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 Worker 详情失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeployClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setDeploying(true)
    setDeploySuccess('')
    setError('')

    try {
      const formData = new FormData()
      formData.append('files', file)

      await api(`/api/accounts/${accountId}/workers/${workerName}/deploy`, {
        method: 'POST',
        body: formData,
      })

      setDeploySuccess('Worker 部署成功！')
      addToast('部署成功', 'success')
      await fetchWorker()
    } catch {
      // 错误已由 api 自动 toast，此处仅收尾
    } finally {
      setDeploying(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  if (loading) {
    return <LoadingBlock label="正在加载 Worker 详情" />
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate(`/accounts/${accountId}/workers`)}
        className="flex items-center gap-2 text-sm text-text-muted hover:text-text-main mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        返回 Workers 列表
      </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-cf-orange">{workerName}</h1>
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30">
                Worker
              </span>
            </div>
            <p className="text-text-muted mt-1">Worker 详情与配置</p>
          </div>
        </div>

        {/* Error */}
        <ErrorBanner error={error} onDismiss={() => setError('')} />

        {/* Basic Info Card */}
        <div className="bg-surface-2 rounded-xl border border-border-subtle p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-main mb-4">基本信息</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-text-muted">ID</p>
              <p className="text-text-main font-mono text-sm">{worker?.id || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-text-muted">名称</p>
              <p className="text-text-main">{worker?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-text-muted">创建时间</p>
              <p className="text-text-main">
                {worker?.created_on ? formatDateTime(worker.created_on) : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-text-muted">修改时间</p>
              <p className="text-text-main">
                {worker?.updated_on ? formatDateTime(worker.updated_on) : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Routes */}
        <div className="bg-surface-2 rounded-xl border border-border-subtle p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-main mb-4">路由</h2>
          {worker?.routes && worker.routes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {worker.routes.map((route, i) => (
                <span
                  key={route.id ?? i}
                  className="flex items-center gap-2 bg-surface-3 rounded-lg px-3 py-2 text-sm"
                >
                  <span className="text-blue-400 font-mono">{route.pattern}</span>
                  {route.id && <span className="text-text-faint">({route.id})</span>}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-sm">未绑定任何路由。</p>
          )}
        </div>

        {/* Deploy Section */}
        <div className="bg-surface-2 rounded-xl border border-border-subtle p-6">
          <h2 className="text-lg font-semibold text-text-main mb-4">部署</h2>
          <p className="text-text-muted text-sm mb-4">
            上传 ZIP 文件即可部署该 Worker 的新版本。
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            onChange={handleFileChange}
            className="hidden"
          />
          <Button onClick={handleDeployClick} loading={deploying}>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {deploying ? '部署中...' : '上传并部署'}
          </Button>

          {/* Deploy result */}
          {deploySuccess && (
            <div className="mt-4 p-4 rounded-lg border bg-green-500/10 border-green-500/30 text-green-400">
              {deploySuccess}
            </div>
          )}
        </div>

      </div>
  )
}
