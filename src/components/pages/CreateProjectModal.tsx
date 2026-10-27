import { useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import ErrorBanner from '../ui/ErrorBanner'
import Modal from '../ui/Modal'

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
      setError(err instanceof Error ? err.message : '创建 Pages 项目失败')
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

  return (
    <Modal
      open={open}
      title="Create Pages Project"
      onClose={handleClose}
      closable={!loading}
    >
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
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  )
}
