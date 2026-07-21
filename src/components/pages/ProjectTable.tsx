import Button from '../ui/Button'

interface PagesProject {
  id: string
  name: string
  created_on: string
  production_branch: string
  subdomain: string
  domains: string[]
  uses_functions: boolean
  source?: {
    type: string
    config: {
      owner: string
      repo_name: string
      production_branch: string
    }
  }
}

interface ProjectTableProps {
  projects: PagesProject[]
  onDelete: (name: string) => void
  onDeploy: (name: string) => void
  deletingName: string | null
  deployingName: string | null
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

export default function ProjectTable({
  projects,
  onDelete,
  onDeploy,
  deletingName,
  deployingName,
}: ProjectTableProps) {
  if (projects.length === 0) {
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
            d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
          />
        </svg>
        <p className="text-gray-400">No Pages projects found</p>
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
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Domains</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Functions</th>
            <th className="text-right py-3 px-4 text-sm font-medium text-gray-400">Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr
              key={project.id}
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
                        d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
                      />
                    </svg>
                  </div>
                  <span className="text-white font-medium">{project.name}</span>
                </div>
              </td>
              <td className="py-3 px-4 text-sm text-gray-400">
                {formatDate(project.created_on)}
              </td>
              <td className="py-3 px-4">
                {project.domains && project.domains.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {project.domains.slice(0, 2).map((domain, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 text-xs rounded bg-cf-dark-700 text-gray-300 font-mono"
                      >
                        {domain}
                      </span>
                    ))}
                    {project.domains.length > 2 && (
                      <span className="px-2 py-0.5 text-xs rounded bg-cf-dark-700 text-gray-400">
                        +{project.domains.length - 2}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">-</span>
                )}
              </td>
              <td className="py-3 px-4">
                {project.uses_functions ? (
                  <span className="px-2 py-0.5 text-xs rounded bg-green-500/10 text-green-400 border border-green-500/30">
                    Enabled
                  </span>
                ) : (
                  <span className="text-sm text-gray-500">-</span>
                )}
              </td>
              <td className="py-3 px-4 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => onDeploy(project.name)}
                    loading={deployingName === project.name}
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
                    variant="danger"
                    onClick={() => onDelete(project.name)}
                    loading={deletingName === project.name}
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