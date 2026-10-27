import { ResourceItem } from '../../types'
import DataTable, { DataTableColumn } from '../ui/DataTable'
import { formatRelativeTime } from '../../lib/datetime'

interface ResourceTableProps {
  resources: ResourceItem[]
  selected: Set<string>
  onSelect: (key: string) => void
  onSelectAll: () => void
  onRowClick: (resource: ResourceItem) => void
  loading?: boolean
}

function resourceKey(r: ResourceItem): string {
  return `${r.accountId}:${r.name}`
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

/**
 * 资源列表（L3）：主体表格交给 DataTable，排序与搜索由 DataTable 承担。
 *
 * 两处需要绕开 DataTable 的列模型：
 * - 表头全选框：DataTable 的 header 只接受字符串，因此把"全选/取消全选"放进
 *   toolbar 插槽，行内复选框仍是第一列（stopRowClick 避免误触发行跳转）。
 * - 选中行高亮：DataTable 不暴露行 className 钩子，选中态由复选框本身表达。
 */
export default function ResourceTable({
  resources,
  selected,
  onSelect,
  onSelectAll,
  onRowClick,
  loading = false,
}: ResourceTableProps) {
  const allSelected = resources.length > 0 && resources.every((r) => selected.has(resourceKey(r)))

  const columns: DataTableColumn<ResourceItem>[] = [
    {
      key: 'select',
      header: '',
      stopRowClick: true,
      searchable: false,
      render: (resource) => (
        <input
          type="checkbox"
          checked={selected.has(resourceKey(resource))}
          onChange={() => onSelect(resourceKey(resource))}
          aria-label={`选择资源 ${resource.name}`}
          className="w-4 h-4 rounded border-border-strong bg-surface-3 text-cf-orange focus:ring-cf-orange/50 cursor-pointer"
        />
      ),
    },
    {
      key: 'name',
      header: '名称',
      value: (resource) => resource.name,
      sortable: true,
      render: (resource) => <span className="text-text-main font-medium">{resource.name}</span>,
    },
    {
      key: 'type',
      header: '类型',
      value: (resource) => resource.type,
      sortable: true,
      render: (resource) => <TypeBadge type={resource.type} />,
    },
    {
      key: 'accountName',
      header: '账户',
      value: (resource) => resource.accountName,
      sortable: true,
      render: (resource) => <span className="text-text-muted">{resource.accountName}</span>,
    },
    {
      key: 'modifiedOn',
      header: '最近修改',
      // 排序按原始时间戳，展示用相对时间
      value: (resource) => resource.modifiedOn,
      sortable: true,
      render: (resource) => (
        <span className="text-text-muted">{formatRelativeTime(resource.modifiedOn)}</span>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={resources}
      rowKey={resourceKey}
      onRowClick={onRowClick}
      loading={loading}
      searchPlaceholder="搜索资源名称或账户"
      pageSize={20}
      emptyTitle="暂无资源"
      emptyDescription="所有账户下都还没有 Workers 或 Pages 资源"
      emptyIcon="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
      toolbar={
        <button
          type="button"
          onClick={onSelectAll}
          className="text-sm text-text-muted hover:text-text-main transition-colors"
        >
          {allSelected ? '取消全选' : '全选'}
        </button>
      }
    />
  )
}
