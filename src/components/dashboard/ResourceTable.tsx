import { ResourceItem } from '../../types'

interface ResourceTableProps {
  resources: ResourceItem[]
  selected: Set<string>
  onSelect: (key: string) => void
  onSelectAll: () => void
  onRowClick: (resource: ResourceItem) => void
  sortField: string
  sortDir: 'asc' | 'desc'
  onSort: (field: string) => void
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

function resourceKey(r: ResourceItem): string {
  return `${r.accountId}:${r.name}`
}

function SortIndicator({ field, sortField, sortDir }: { field: string; sortField: string; sortDir: 'asc' | 'desc' }) {
  if (field !== sortField) {
    return <span className="text-gray-600 ml-1">↕</span>
  }
  return <span className="text-cf-orange ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

function TypeBadge({ type }: { type: 'worker' | 'pages' }) {
  const colors =
    type === 'worker'
      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      : 'bg-green-500/20 text-green-400 border-green-500/30'

  return (
    <span className={`px-2 py-0.5 text-xs rounded-full border font-medium ${colors}`}>
      {type === 'worker' ? 'Worker' : 'Pages'}
    </span>
  )
}

export default function ResourceTable({
  resources,
  selected,
  onSelect,
  onSelectAll,
  onRowClick,
  sortField,
  sortDir,
  onSort,
}: ResourceTableProps) {
  if (resources.length === 0) {
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
        <p className="text-gray-400">No resources found</p>
      </div>
    )
  }

  const allSelected = resources.length > 0 && resources.every((r) => selected.has(resourceKey(r)))

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-cf-dark-700">
            <th className="text-left py-3 px-4 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className="w-4 h-4 rounded border-gray-500 bg-cf-dark-700 text-cf-orange focus:ring-cf-orange/50 cursor-pointer"
              />
            </th>
            <th
              className="text-left py-3 px-4 text-sm font-medium text-gray-400 cursor-pointer select-none hover:text-gray-200"
              onClick={() => onSort('name')}
            >
              Name
              <SortIndicator field="name" sortField={sortField} sortDir={sortDir} />
            </th>
            <th
              className="text-left py-3 px-4 text-sm font-medium text-gray-400 cursor-pointer select-none hover:text-gray-200"
              onClick={() => onSort('type')}
            >
              Type
              <SortIndicator field="type" sortField={sortField} sortDir={sortDir} />
            </th>
            <th
              className="text-left py-3 px-4 text-sm font-medium text-gray-400 cursor-pointer select-none hover:text-gray-200"
              onClick={() => onSort('accountName')}
            >
              Account
              <SortIndicator field="accountName" sortField={sortField} sortDir={sortDir} />
            </th>
            <th
              className="text-left py-3 px-4 text-sm font-medium text-gray-400 cursor-pointer select-none hover:text-gray-200"
              onClick={() => onSort('modifiedOn')}
            >
              Modified
              <SortIndicator field="modifiedOn" sortField={sortField} sortDir={sortDir} />
            </th>
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => {
            const key = resourceKey(resource)
            const isSelected = selected.has(key)

            return (
              <tr
                key={key}
                onClick={() => onRowClick(resource)}
                className={`border-b border-cf-dark-700/50 transition-colors cursor-pointer ${
                  isSelected ? 'bg-cf-dark-700/50' : 'hover:bg-cf-dark-700/30'
                }`}
              >
                <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onSelect(key)}
                    className="w-4 h-4 rounded border-gray-500 bg-cf-dark-700 text-cf-orange focus:ring-cf-orange/50 cursor-pointer"
                  />
                </td>
                <td className="py-3 px-4">
                  <span className="text-white font-medium">{resource.name}</span>
                </td>
                <td className="py-3 px-4">
                  <TypeBadge type={resource.type} />
                </td>
                <td className="py-3 px-4 text-sm text-gray-400">{resource.accountName}</td>
                <td className="py-3 px-4 text-sm text-gray-400">{formatDate(resource.modifiedOn)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
