import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'

interface WorkerDetail {
  id: string
  name: string
  created_on: string
  modified_on: string
  routes?: Array<{
    pattern: string
    zone_id: string
    zone_name: string
    priority: number
  }>
}

export default function WorkerDetail() {
  const { accountId, workerName } = useParams<{ accountId: string; workerName: string }>()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [worker, setWorker] = useState<WorkerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [deployResult, setDeployResult] = useState<{ success: boolean; message: string } | null>(null)

  useEffect(() => {
    fetchWorker()
  }, [accountId, workerName])

  const fetchWorker = async () => {
    try {
      const response = await fetch(`/api/accounts/${accountId}/workers/${workerName}`)
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setWorker(data.worker)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load worker')
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
    setDeployResult(null)
    setError('')

    try {
      const formData = new FormData()
      formData.append('files', file)

      const response = await fetch(`/api/accounts/${accountId}/workers/${workerName}/deploy`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setDeployResult({ success: true, message: 'Worker deployed successfully!' })
      await fetchWorker()
    } catch (err) {
      setDeployResult({ success: false, message: err instanceof Error ? err.message : 'Deploy failed' })
    } finally {
      setDeploying(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-4 border-cf-orange border-t-transparent rounded-full" />
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Back button */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
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
            <p className="text-gray-400 mt-1">Worker detail and configuration</p>
          </div>
        </div>

        {/* Error */}
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

        {/* Basic Info Card */}
        <div className="bg-cf-dark-800 rounded-xl border border-cf-dark-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-400">ID</p>
              <p className="text-white font-mono text-sm">{worker?.id || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Name</p>
              <p className="text-white">{worker?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Created</p>
              <p className="text-white">{worker?.created_on ? formatDate(worker.created_on) : '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Modified</p>
              <p className="text-white">{worker?.modified_on ? formatDate(worker.modified_on) : '-'}</p>
            </div>
          </div>

          {/* Routes */}
          {worker?.routes && worker.routes.length > 0 && (
            <div className="mt-6">
              <p className="text-sm text-gray-400 mb-2">Routes</p>
              <div className="space-y-2">
                {worker.routes.map((route, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-cf-dark-700 rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="text-blue-400 font-mono">{route.pattern}</span>
                    <span className="text-gray-500">({route.zone_name})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Deploy Section */}
        <div className="bg-cf-dark-800 rounded-xl border border-cf-dark-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">Deploy</h2>
          <p className="text-gray-400 text-sm mb-4">
            Upload a ZIP file to deploy a new version of this worker.
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
            {deploying ? 'Deploying...' : 'Upload & Deploy'}
          </Button>

          {/* Deploy result */}
          {deployResult && (
            <div
              className={`mt-4 p-4 rounded-lg border ${
                deployResult.success
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              {deployResult.message}
            </div>
          )}
        </div>

        {/* Config Section */}
        <div className="bg-cf-dark-800 rounded-xl border border-cf-dark-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Configuration</h2>
          <p className="text-gray-400 text-sm">Configuration management coming soon.</p>
        </div>
      </div>
    </Layout>
  )
}
