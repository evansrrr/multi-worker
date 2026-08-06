import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import ResourceTable from '../../components/dashboard/ResourceTable'
import BatchToolbar from '../../components/dashboard/BatchToolbar'
import BatchDeployModal from '../../components/dashboard/BatchDeployModal'
import { ResourceItem } from '../../types'

export default function Dashboard() {
  const navigate = useNavigate()
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState('modifiedOn')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [batchLoading, setBatchLoading] = useState(false)
  const [showDeployModal, setShowDeployModal] = useState(false)

  useEffect(() => {
    fetchResources()
  }, [])

  const fetchResources = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/resources')
      const data = await res.json()
      if (data.resources) {
        setResources(data.resources)
      } else if (data.error) {
        setError(data.error.message || 'Failed to fetch resources')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch resources')
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

  const handleBatchDelete = async () => {
    if (selected.size === 0) return

    setBatchLoading(true)
    setError('')
    try {
      const targets = selectedResources.map((r) => ({
        accountId: r.accountId,
        name: r.name,
        type: r.type,
      }))
      const res = await fetch('/api/batch/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets }),
      })
      const data = await res.json()
      if (data.results) {
        const failures = data.results.filter((r: { success: boolean }) => !r.success)
        if (failures.length > 0) {
          setError(`Failed to delete: ${failures.map((f: { name: string }) => f.name).join(', ')}`)
        }
        setSelected(new Set())
        await fetchResources()
      } else if (data.error) {
        setError(data.error.message || 'Batch delete failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch delete failed')
    } finally {
      setBatchLoading(false)
    }
  }

  const handleBatchDeploy = async (file: File) => {
    setBatchLoading(true)
    setError('')
    try {
      const targets = selectedResources.map((r) => ({
        accountId: r.accountId,
        name: r.name,
        type: r.type,
      }))
      const formData = new FormData()
      formData.append('files', file)
      formData.append('targets', JSON.stringify(targets))

      const res = await fetch('/api/batch/deploy', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (data.results) {
        const failures = data.results.filter((r: { success: boolean }) => !r.success)
        if (failures.length > 0) {
          setError(`Failed to deploy: ${failures.map((f: { name: string }) => f.name).join(', ')}`)
        }
        setSelected(new Set())
        await fetchResources()
      } else if (data.error) {
        setError(data.error.message || 'Batch deploy failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch deploy failed')
      throw err
    } finally {
      setBatchLoading(false)
    }
  }

  return (
    <Layout>
      <div className="p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">Dashboard</h1>
          <p className="text-gray-400">Overview of all your Cloudflare resources</p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start justify-between">
            <p className="text-sm text-red-400">{error}</p>
            <button
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-300 ml-4 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-cf-dark-800 rounded-xl p-4 border border-cf-dark-700">
            <p className="text-sm text-gray-400 mb-1">Total Resources</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-cf-dark-800 rounded-xl p-4 border border-cf-dark-700">
            <p className="text-sm text-gray-400 mb-1">Workers</p>
            <p className="text-2xl font-bold text-blue-400">{stats.workers}</p>
          </div>
          <div className="bg-cf-dark-800 rounded-xl p-4 border border-cf-dark-700">
            <p className="text-sm text-gray-400 mb-1">Pages</p>
            <p className="text-2xl font-bold text-green-400">{stats.pages}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-cf-dark-800 rounded-xl border border-cf-dark-700">
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
      </div>

      {/* Batch toolbar */}
      <BatchToolbar
        selectedCount={selected.size}
        onDelete={handleBatchDelete}
        onDeploy={() => setShowDeployModal(true)}
        loading={batchLoading}
      />

      {/* Deploy modal */}
      <BatchDeployModal
        open={showDeployModal}
        targets={selectedResources}
        onClose={() => setShowDeployModal(false)}
        onDeploy={handleBatchDeploy}
      />
    </Layout>
  )
}
