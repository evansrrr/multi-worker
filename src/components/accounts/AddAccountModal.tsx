import { useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'

interface AddAccountModalProps {
  open: boolean
  onClose: () => void
  onAdd: (token: string, name?: string) => Promise<void>
}

export default function AddAccountModal({ open, onClose, onAdd }: AddAccountModalProps) {
  const [token, setToken] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [hint, setHint] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setHint('')
    setLoading(true)

    try {
      await onAdd(token, name || undefined)
      setToken('')
      setName('')
      onClose()
    } catch (err) {
      if (err instanceof Error) {
        // Try to parse hint from error message
        const msg = err.message
        const hintMatch = msg.match(/hint:\s*(.+)/i)
        if (hintMatch && hintMatch[1]) {
          setHint(hintMatch[1])
          setError(msg.replace(/hint:\s*.+/i, '').trim())
        } else {
          setError(msg)
        }
      } else {
        setError('Failed to add account')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setToken('')
      setName('')
      setError('')
      setHint('')
      onClose()
    }
  }

  return (
    <Modal
      open={open}
      title="Add Account"
      onClose={handleClose}
      closable={!loading}
      maxWidth="max-w-md"
    >
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

        {hint && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
            <p className="text-xs text-blue-400">
              <span className="font-semibold">Tip:</span> {hint}
            </p>
            <a
              href="https://dash.cloudflare.com/profile/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 underline hover:text-blue-300 mt-1 inline-block"
            >
              Create API Token →
            </a>
          </div>
        )}

        <p className="text-xs text-text-faint">
          Your token will be encrypted and stored securely. Required permissions: Account → Workers (Edit) or All Resources.
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
    </Modal>
  )
}
