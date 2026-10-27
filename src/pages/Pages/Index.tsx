import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../../components/layout/Layout'
import ProjectTable from '../../components/pages/ProjectTable'
import CreateProjectModal from '../../components/pages/CreateProjectModal'
import DeployModal from '../../components/pages/DeployModal'
import Button from '../../components/ui/Button'

interface PagesProject {
  id: string
  name: string
  created_on: string
  modified_on?: string
  production_branch: string
  subdomain: string
  domains: string[]
  uses_functions: boolean
  source?: {
    type: string
    config: {
      owner: string
      repo_name: string
      production_branch: string
    }
  }
}

interface ResultInfo {
  count?: number
  page?: number
  per_page?: number
  total_count?: number
}

export default function Pages() {
  const { accountId } = useParams()
  const [projects, setProjects] = useState<PagesProject[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeployModal, setShowDeployModal] = useState(false)
  const [deployProjectName, setDeployProjectName] = useState<string | null>(null)
  const [deletingName, setDeletingName] = useState<string | null>(null)
  const [deployingName, setDeployingName] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [resultInfo, setResultInfo] = useState<ResultInfo | null>(null)

  const PER_PAGE = 20

  const fetchProjects = async (nextPage = 1, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const response = await fetch(
        `/api/accounts/${accountId}/pages?page=${nextPage}&per_page=${PER_PAGE}`
      )
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      const incoming: PagesProject[] = data.projects || []
      setProjects((prev) => (append ? [...prev, ...incoming] : incoming))
      setResultInfo(data.result_info || null)
      setPage(nextPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Pages projects')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchProjects(1, false)
  }, [accountId])

  const hasMore = resultInfo
    ? (resultInfo.page ?? 1) * (resultInfo.per_page ?? PER_PAGE) < (resultInfo.total_count ?? 0)
    : false

  const handleCreateProject = async (name: string, productionBranch?: string) => {
    const response = await fetch(`/api/accounts/${accountId}/pages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, production_branch: productionBranch }),
    })

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error)
    }

    if (data.project) {
      setProjects((prev) => [...prev, data.project])
    }
  }

  const handleDeleteProject = async (name: string) => {
    if (!confirm(`Are you sure you want to delete Pages project "${name}"?`)) {
      return
    }

    setDeletingName(name)
    try {
      const response = await fetch(`/api/accounts/${accountId}/pages/${name}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setProjects((prev) => prev.filter((p) => p.name !== name))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete Pages project')
    } finally {
      setDeletingName(null)
    }
  }

  const handleDeployProject = async (name: string, file: File) => {
    setDeployingName(name)
    try {
      const formData = new FormData()
      formData.append('files', file)

      const response = await fetch(`/api/accounts/${accountId}/pages/${name}/deploy`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deploy Pages project')
    } finally {
      setDeployingName(null)
    }
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-cf-orange">Pages</h1>
            <p className="text-gray-400 mt-1">Manage Pages projects for this account</p>
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
            Create Project
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
            <ProjectTable
              projects={projects}
              onDelete={handleDeleteProject}
              onDeploy={(name) => {
                setDeployProjectName(name)
                setShowDeployModal(true)
              }}
              deletingName={deletingName}
              deployingName={deployingName}
            />
            {hasMore && (
              <div className="p-4 border-t border-cf-dark-700">
                <Button
                  variant="secondary"
                  onClick={() => fetchProjects(page + 1, true)}
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

      <CreateProjectModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateProject}
      />

      <DeployModal
        open={showDeployModal}
        projectName={deployProjectName}
        onClose={() => {
          setShowDeployModal(false)
          setDeployProjectName(null)
        }}
        onDeploy={handleDeployProject}
      />
    </Layout>
  )
}