import Button from '../ui/Button'

interface BatchToolbarProps {
  selectedCount: number
  onDelete: () => void
  onDeploy: () => void
  loading?: boolean
}

export default function BatchToolbar({
  selectedCount,
  onDelete,
  onDeploy,
  loading = false,
}: BatchToolbarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-0 left-[260px] right-0 z-50 animate-slide-up">
      <div className="bg-cf-dark-800 border-t border-cf-dark-600 px-6 py-3 flex items-center justify-between">
        <span className="text-sm text-gray-300">
          <span className="font-semibold text-white">{selectedCount}</span>{' '}
          item{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <div className="flex items-center gap-3">
          <Button variant="danger" onClick={onDelete} loading={loading}>
            Delete Selected
          </Button>
          <Button variant="primary" onClick={onDeploy} loading={loading}>
            Deploy Selected
          </Button>
        </div>
      </div>
    </div>
  )
}
