import Button from '../ui/Button'

interface AccountCardProps {
  id: string
  name: string
  email?: string
  type?: string
  onManage: () => void
  onVerify: () => void
  onDelete: () => void
  onRename?: () => void
  verifying?: boolean
  deleting?: boolean
}

export default function AccountCard({
  id,
  name,
  email,
  type,
  onManage,
  onVerify,
  onDelete,
  onRename,
  verifying = false,
  deleting = false,
}: AccountCardProps) {
  const shortId = id.length > 12 ? `${id.slice(0, 8)}...` : id

  return (
    <div className="bg-surface-2 rounded-xl p-6 shadow-lg border border-border-subtle hover:border-cf-orange/30 transition-colors">
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
            <div className="flex items-center gap-2">
              <h3 className="text-text-main font-semibold text-lg">{name}</h3>
              {onRename && (
                <button
                  type="button"
                  onClick={onRename}
                  disabled={verifying || deleting}
                  title="编辑账户名称"
                  aria-label="编辑账户名称"
                  className="text-text-faint hover:text-text-main transition-colors disabled:opacity-50"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.862 4.487zm0 0L19.5 7.125"
                    />
                  </svg>
                </button>
              )}
            </div>
            {email && (
              <p className="text-text-muted text-sm">{email}</p>
            )}
          </div>
        </div>
        {type && (
          <span className="px-2 py-1 text-xs rounded-full bg-surface-3 text-text-main capitalize">
            {type}
          </span>
        )}
      </div>

      <div className="space-y-2 mb-6">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-text-faint">ID:</span>
          <code className="text-text-main bg-surface px-2 py-0.5 rounded text-xs font-mono">
            {shortId}
          </code>
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={onManage}
          disabled={verifying || deleting}
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
          管理
        </Button>
        <Button
          variant="secondary"
          onClick={onVerify}
          loading={verifying}
          disabled={deleting}
          title="重新校验该账户的 API Token"
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
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          重新校验
        </Button>
        <Button
          variant="danger"
          onClick={onDelete}
          loading={deleting}
          disabled={verifying}
          aria-label="删除账户"
          title="删除账户"
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
