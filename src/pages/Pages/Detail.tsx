import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import ErrorBanner from '../../components/ui/ErrorBanner'
import { useToast } from '../../hooks/useToast'
import { api, apiGet } from '../../lib/api'

interface PagesProjectDetail {
  id: string
  name: string
  created_on: string
  subdomain: string
  domains: string[]
  production_branch: string
}

export default function PagesDetail() {
  const { accountId, projectName } = useParams<{ accountId: string; projectName: string }>()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [project, setProject] = useState<PagesProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deploying, setDeploying] = useState(false)
  const [deploySuccess, setDeploySuccess] = useState('')

  useEffect(() => {
    fetchProject()
  }, [accountId, projectName])

  const fetchProject = async () => {
    try {
      const data = await apiGet<{ project?: PagesProjectDetail }>(
        `/api/accounts/${accountId}/pages/${projectName}`
      )
      setProject(data.project ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载 Pages 项目详情失败')
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

      await api(`/api/accounts/${accountId}/pages/${projectName}/deploy`, {
        method: 'POST',
        body: formData,
      })

      setDeploySuccess('Pages 项目部署成功！')
      addToast('部署成功', 'success')
      await fetchProject()
    } catch {
      // 错误已由 api 自动 toast，此处仅收尾
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
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-4 border-cf-orange border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Back button */}
      <button
        onClick={() => navigate(`/accounts/${accountId}/pages`)}
        className="flex items-center gap-2 text-sm text-text-muted hover:text-text-main mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Pages
      </button>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-cf-orange">{projectName}</h1>
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-500/10 text-green-400 border border-green-500/30">
                Pages
              </span>
            </div>
            <p className="text-text-muted mt-1">Pages project detail and configuration</p>
          </div>
        </div>

        {/* Error */}
        <ErrorBanner error={error} onDismiss={() => setError('')} />

        {/* Basic Info Card */}
        <div className="bg-surface-2 rounded-xl border border-border-subtle p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-main mb-4">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-text-muted">ID</p>
              <p className="text-text-main font-mono text-sm">{project?.id || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-text-muted">Name</p>
              <p className="text-text-main">{project?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-text-muted">Created</p>
              <p className="text-text-main">{project?.created_on ? formatDate(project.created_on) : '-'}</p>
            </div>
            <div>
              <p className="text-sm text-text-muted">Subdomain</p>
              <p className="text-text-main">
                {project?.subdomain ? (
                  <a
                    href={`https://${project.subdomain}.pages.dev`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300"
                  >
                    {project.subdomain}.pages.dev
                  </a>
                ) : (
                  '-'
                )}
              </p>
            </div>
          </div>

          {/* Custom Domains */}
          {project?.domains && project.domains.length > 0 && (
            <div className="mt-6">
              <p className="text-sm text-text-muted mb-2">Custom Domains</p>
              <div className="space-y-2">
                {project.domains.map((domain, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-surface-3 rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="text-blue-400 font-mono">{domain}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Deploy Section */}
        <div className="bg-surface-2 rounded-xl border border-border-subtle p-6 mb-6">
          <h2 className="text-lg font-semibold text-text-main mb-4">Deploy</h2>
          <p className="text-text-muted text-sm mb-4">
            Upload a ZIP file to deploy a new version of this Pages project.
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
          {deploySuccess && (
            <div className="mt-4 p-4 rounded-lg border bg-green-500/10 border-green-500/30 text-green-400">
              {deploySuccess}
            </div>
          )}
        </div>

        {/* Config Section */}
        <div className="bg-surface-2 rounded-xl border border-border-subtle p-6">
          <h2 className="text-lg font-semibold text-text-main mb-4">Configuration</h2>
          <p className="text-text-muted text-sm">Configuration management coming soon.</p>
        </div>
      </div>
  )
}
