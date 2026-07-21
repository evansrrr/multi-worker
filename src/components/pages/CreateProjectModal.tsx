import { useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'

interface CreateProjectModalProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, productionBranch?: string) => Promise<void>
}

export default function CreateProjectModal({ open, onClose, onCreate }: CreateProjectModalProps) {
  const [name, setName] = useState('')
  const [productionBranch, setProductionBranch] = useState('main')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await onCreate(name, productionBranch || undefined)
      setName('')
      setProductionBranch('main')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setName('')
      setProductionBranch('main')
      setError('')
      onClose()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-cf-dark-800 rounded-xl p-6 w-full max-w-lg shadow-2xl border border-cf-dark-700 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Create Pages Project</h2>
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
          <Input
            id="project-name"
            label="Project Name"
            placeholder="my-pages-project"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          <Input
            id="production-branch"
            label="Production Branch"
            placeholder="main"
            value={productionBranch}
            onChange={(e) => setProductionBranch(e.target.value)}
          />

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
              disabled={!name}
              className="flex-1"
            >
              Create Project
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}