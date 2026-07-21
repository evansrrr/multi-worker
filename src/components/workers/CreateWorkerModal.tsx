import { useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'

interface CreateWorkerModalProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, script?: string) => Promise<void>
}

export default function CreateWorkerModal({ open, onClose, onCreate }: CreateWorkerModalProps) {
  const [name, setName] = useState('')
  const [script, setScript] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await onCreate(name, script || undefined)
      setName('')
      setScript('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create worker')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setName('')
      setScript('')
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
          <h2 className="text-xl font-bold text-white">Create Worker</h2>
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
            id="worker-name"
            label="Worker Name"
            placeholder="my-worker"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">
              Script (optional)
            </label>
            <textarea
              id="worker-script"
              className="w-full px-3 py-2 bg-cf-dark-800 border border-cf-dark-600 rounded-lg 
                text-white placeholder-gray-500 font-mono text-sm
                focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent
                min-h-[150px] resize-y"
              placeholder={`export default {
  async fetch(request) {
    return new Response("Hello World!");
  },
};`}
              value={script}
              onChange={(e) => setScript(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-gray-500">
              Leave empty for a default hello world worker
            </p>
          </div>

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
              Create Worker
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
