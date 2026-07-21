import Button from '../ui/Button'

interface AccountCardProps {
  id: string
  name: string
  email?: string
  type?: string
  createdOn?: string
  onManage: () => void
  onDelete: () => void
  deleting?: boolean
}

export default function AccountCard({
  id,
  name,
  email,
  type,
  onManage,
  onDelete,
  deleting = false,
}: AccountCardProps) {
  const shortId = id.length > 12 ? `${id.slice(0, 8)}...` : id

  return (
    <div className="bg-cf-dark-800 rounded-xl p-6 shadow-lg border border-cf-dark-700 hover:border-cf-orange/30 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-cf-orange/10 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-cf-orange"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-white font-semibold text-lg">{name}</h3>
            {email && (
              <p className="text-gray-400 text-sm">{email}</p>
            )}
          </div>
        </div>
        {type && (
          <span className="px-2 py-1 text-xs rounded-full bg-cf-dark-700 text-gray-300 capitalize">
            {type}
          </span>
        )}
      </div>

      <div className="space-y-2 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">ID:</span>
          <code className="text-gray-300 bg-cf-dark-900 px-2 py-0.5 rounded text-xs font-mono">
            {shortId}
          </code>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={onManage}
          className="flex-1 text-sm"
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
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          Manage
        </Button>
        <Button
          variant="danger"
          onClick={onDelete}
          loading={deleting}
          className="text-sm"
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </Button>
      </div>
    </div>
  )
}
