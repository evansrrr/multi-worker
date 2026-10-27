import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import WorkerTable from '../../components/workers/WorkerTable'
import CreateWorkerModal from '../../components/workers/CreateWorkerModal'
import BindingsEditor from '../../components/workers/BindingsEditor'
import WorkerDeployModal from '../../components/workers/WorkerDeployModal'
import Button from '../../components/ui/Button'

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

export default function Workers() {
  const { accountId } = useParams()
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deletingName, setDeletingName] = useState<string | null>(null)
  const [bindingsWorkerName, setBindingsWorkerName] = useState<string | null>(null)
  const [deployWorkerName, setDeployWorkerName] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [resultInfo, setResultInfo] = useState<ResultInfo | null>(null)

  const PER_PAGE = 20

  const fetchWorkers = async (nextPage = 1, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const response = await fetch(
        `/api/accounts/${accountId}/workers?page=${nextPage}&per_page=${PER_PAGE}`
      )
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      const incoming: Worker[] = data.workers || []
      setWorkers((prev) => (append ? [...prev, ...incoming] : incoming))
      setResultInfo(data.result_info || null)
      setPage(nextPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workers')
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
    const response = await fetch(`/api/accounts/${accountId}/workers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, script }),
    })

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error)
    }

    if (data.worker) {
      setWorkers((prev) => [...prev, data.worker])
    }
  }

  const handleDeleteWorker = async (name: string) => {
    if (!confirm(`Are you sure you want to delete worker "${name}"?`)) {
      return
    }

    setDeletingName(name)
    try {
      const response = await fetch(`/api/accounts/${accountId}/workers/${name}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setWorkers((prev) => prev.filter((w) => w.name !== name))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete worker')
    } finally {
      setDeletingName(null)
    }
  }

  const handleDeployWorker = async (name: string, files: File[]) => {
    const formData = new FormData()
    files.forEach((file) => {
      formData.append('files', file)
    })

    const response = await fetch(`/api/accounts/${accountId}/workers/${name}/deploy`, {
      method: 'POST',
      body: formData,
    })

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error)
    }
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-cf-orange">Workers</h1>
            <p className="text-gray-400 mt-1">Manage workers for this account</p>
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

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => setError('')}
              className="text-sm text-red-400 hover:text-red-300 mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-cf-orange border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="bg-cf-dark-800 rounded-xl shadow-lg border border-cf-dark-700">
            <WorkerTable
              workers={workers}
              onDelete={handleDeleteWorker}
              onManageBindings={(name) => setBindingsWorkerName(name)}
              onDeploy={(name) => setDeployWorkerName(name)}
              deletingName={deletingName}
            />
            {hasMore && (
              <div className="p-4 border-t border-cf-dark-700">
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
      </div>

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
    </Layout>
  )
}
