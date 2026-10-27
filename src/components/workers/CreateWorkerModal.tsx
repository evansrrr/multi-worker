import { useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import ErrorBanner from '../ui/ErrorBanner'
import Modal from '../ui/Modal'

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
      setError(err instanceof Error ? err.message : '创建 Worker 失败')
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

  return (
    <Modal
      open={open}
      title="Create Worker"
      onClose={handleClose}
      closable={!loading}
    >
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
          <label className="block text-sm font-medium text-text-main">
            Script (optional)
          </label>
          <textarea
            id="worker-script"
            className="w-full px-3 py-2 bg-surface-2 border border-border-subtle rounded-lg
              text-text-main placeholder-text-faint font-mono text-sm
              focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent
              min-h-[150px] resize-y"
            placeholder={`export default {
  fetch: async (request) => {
    return new Response("Hello World!");
  },
};`}
            value={script}
            onChange={(e) => setScript(e.target.value)}
            disabled={loading}
          />
          <p className="text-xs text-text-faint">
            Leave empty for a default hello world worker
          </p>
        </div>

        {error && <ErrorBanner error={error} onDismiss={() => setError('')} />}

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
    </Modal>
  )
}
