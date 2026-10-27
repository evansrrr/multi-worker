import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ProjectTable from '../../components/pages/ProjectTable'
import CreateProjectModal from '../../components/pages/CreateProjectModal'
import DeployModal from '../../components/pages/DeployModal'
import Button from '../../components/ui/Button'
import ErrorBanner from '../../components/ui/ErrorBanner'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useToast } from '../../hooks/useToast'
import { api, apiDelete, apiGet, apiPost } from '../../lib/api'

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

interface ProjectsResponse {
  projects?: PagesProject[]
  result_info?: ResultInfo | null
}

export default function Pages() {
  const { accountId } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const [projects, setProjects] = useState<PagesProject[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showDeployModal, setShowDeployModal] = useState(false)
  const [deployProjectName, setDeployProjectName] = useState<string | null>(null)
  const [deletingName, setDeletingName] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deployingName, setDeployingName] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [resultInfo, setResultInfo] = useState<ResultInfo | null>(null)

  const PER_PAGE = 20

  const fetchProjects = async (nextPage = 1, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const data = await apiGet<ProjectsResponse>(
        `/api/accounts/${accountId}/pages?page=${nextPage}&per_page=${PER_PAGE}`
      )

      const incoming: PagesProject[] = data.projects || []
      setProjects((prev) => (append ? [...prev, ...incoming] : incoming))
      setResultInfo(data.result_info || null)
      setPage(nextPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 Pages 项目列表失败')
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
    // 创建失败由 CreateProjectModal 内联展示，故 silent
    const data = await apiPost<{ project?: PagesProject }>(
      `/api/accounts/${accountId}/pages`,
      { name, production_branch: productionBranch },
      { silent: true }
    )

    const project = data.project
    if (project) {
      setProjects((prev) => [...prev, project])
    }
    addToast('Pages 项目已创建', 'success')
  }

  const handleDeleteProject = (name: string) => {
    setDeleteTarget(name)
  }

  const performDeleteProject = async () => {
    const name = deleteTarget
    if (!name) return

    setDeletingName(name)
    try {
      await apiDelete(`/api/accounts/${accountId}/pages/${name}`)
      setProjects((prev) => prev.filter((p) => p.name !== name))
      addToast('Pages 项目已删除', 'success')
      setDeleteTarget(null)
    } catch {
      // 错误已由 api 自动 toast，此处仅收尾；弹窗保持打开以便重试
    } finally {
      setDeletingName(null)
    }
  }

  const handleDeployProject = async (name: string, file: File) => {
    setDeployingName(name)
    try {
      const formData = new FormData()
      formData.append('files', file)

      // 部署失败由 DeployModal 内联展示，故 silent
      await api(`/api/accounts/${accountId}/pages/${name}/deploy`, {
        method: 'POST',
        body: formData,
        silent: true,
      })
      addToast('部署成功', 'success')
    } finally {
      setDeployingName(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-cf-orange">Pages</h1>
          <p className="text-text-muted mt-1">Manage Pages projects for this account</p>
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

        <ErrorBanner error={error} onDismiss={() => setError('')} />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-cf-orange border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="bg-surface-2 rounded-xl shadow-lg border border-border-subtle">
            <ProjectTable
              projects={projects}
              onDelete={handleDeleteProject}
              onDeploy={(name) => {
                setDeployProjectName(name)
                setShowDeployModal(true)
              }}
              onRowClick={(name) =>
                navigate(`/accounts/${accountId}/pages/${encodeURIComponent(name)}`)
              }
              deletingName={deletingName}
              deployingName={deployingName}
            />
            {hasMore && (
              <div className="p-4 border-t border-border-subtle">
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

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除 Pages 项目"
        message={
          <>
            确定要删除 Pages 项目 <span className="font-mono text-cf-orange">{deleteTarget}</span> 吗？
            该操作不可恢复。
          </>
        }
        confirmText="删除"
        danger
        requireName={deleteTarget ?? undefined}
        loading={!!deleteTarget && deletingName === deleteTarget}
        onConfirm={performDeleteProject}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}
