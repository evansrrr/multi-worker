import Button from '../ui/Button'

interface Worker {
  id: string
  name: string
  created_on: string
  updated_on: string
  routes?: Array<{
    pattern: string
    zone_id: string
    zone_name: string
    priority: number
  }>
}

interface WorkerTableProps {
  workers: Worker[]
  onDelete: (name: string) => void
  onManageBindings: (name: string) => void
  onDeploy: (name: string) => void
  deletingName: string | null
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function WorkerTable({ workers, onDelete, onManageBindings, onDeploy, deletingName }: WorkerTableProps) {
  if (workers.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="w-12 h-12 text-gray-500 mx-auto mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
          />
        </svg>
        <p className="text-gray-400">No workers found</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-cf-dark-700">
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Name</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Created</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Modified</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Routes</th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
          </tr>
        </thead>
        <tbody>
          {workers.map((worker) => (
            <tr
              key={worker.id}
              className="border-b border-cf-dark-700/50 hover:bg-cf-dark-700/30 transition-colors"
            >
              <td className="py-3 px-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-cf-orange/10 flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-cf-orange"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
                      />
                    </svg>
                  </div>
                  <span className="text-white font-medium">{worker.name}</span>
                </div>
              </td>
              <td className="py-3 px-4 text-sm text-gray-400">
                {formatDate(worker.created_on)}
              </td>
              <td className="py-3 px-4 text-sm text-gray-400">
                {formatDate(worker.updated_on)}
              </td>
              <td className="py-3 px-4">
                {worker.routes && worker.routes.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {worker.routes.slice(0, 2).map((route, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 text-xs rounded bg-cf-dark-700 text-gray-300 font-mono"
                      >
                        {route.pattern}
                      </span>
                    ))}
                    {worker.routes.length > 2 && (
                      <span className="px-2 py-0.5 text-xs rounded bg-cf-dark-700 text-gray-400">
                        +{worker.routes.length - 2}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">-</span>
                )}
              </td>
              <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => onDeploy(worker.name)}
                    className="text-sm px-3 py-1"
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
                  <Button
                    variant="secondary"
                    onClick={() => onManageBindings(worker.name)}
                    className="text-sm px-3 py-1"
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
                        d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-3.37a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.374"
                      />
                    </svg>
                    Bindings
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => onDelete(worker.name)}
                    loading={deletingName === worker.name}
                    className="text-sm px-3 py-1"
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
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
