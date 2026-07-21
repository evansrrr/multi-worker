import { useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'

interface AddAccountModalProps {
  open: boolean
  onClose: () => void
  onAdd: (token: string, name?: string) => Promise<void>
}

export default function AddAccountModal({ open, onClose, onAdd }: AddAccountModalProps) {
  const [token, setToken] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await onAdd(token, name || undefined)
      setToken('')
      setName('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add account')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setToken('')
      setName('')
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
      <div className="relative bg-cf-dark-800 rounded-xl p-6 w-full max-w-md shadow-2xl border border-cf-dark-700 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Add Account</h2>
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
            id="account-name"
            label="Account Name"
            placeholder="My Cloudflare Account"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <Input
            id="account-token"
            label="API Token"
            type="password"
            placeholder="Enter your Cloudflare API token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            error={error}
            autoFocus
          />

          <p className="text-xs text-gray-500">
            Your token will be encrypted and stored securely. We'll verify it has the required permissions.
          </p>

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
              disabled={!token}
              className="flex-1"
            >
              Add Account
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
