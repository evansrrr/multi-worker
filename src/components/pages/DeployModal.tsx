import { useState } from 'react'
import Button from '../ui/Button'

interface DeployModalProps {
  open: boolean
  projectName: string | null
  onClose: () => void
  onDeploy: (projectName: string) => Promise<void>
}

export default function DeployModal({ open, projectName, onClose, onDeploy }: DeployModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName) return

    setError('')
    setLoading(true)

    try {
      await onDeploy(projectName)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deploy')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setError('')
      onClose()
    }
  }

  if (!open || !projectName) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-cf-dark-800 rounded-xl p-6 w-full max-w-lg shadow-2xl border border-cf-dark-700 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Deploy Project</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-cf-dark-700 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-2">Project</p>
            <p className="text-white font-medium">{projectName}</p>
          </div>

          <p className="text-gray-400 text-sm">
            This will trigger a new deployment from the latest source. The deployment will be
            available on your project's preview URL once complete.
          </p>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={loading}
              className="flex-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              Deploy
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}