import Button from '../ui/Button'
import DataTable, { DataTableColumn } from '../ui/DataTable'
import { formatDateTime } from '../../lib/datetime'

interface Worker {
  id: string
  name: string
  created_on?: string
  /** 后端 normalizeScript 已把经典脚本的 modified_on ?? created_on 归一成该字段。 */
  updated_on?: string
  /** 经典脚本端点确实返回 routes（官方文档确认），用于展示已绑定路由。 */
  routes?: Array<{ id?: string; pattern?: string; script?: string }>
}

interface WorkerTableProps {
  workers: Worker[]
  onDelete: (name: string) => void
  onManageBindings: (name: string) => void
  onDeploy: (name: string) => void
  deletingName: string | null
  onRowClick?: (name: string) => void
}

/** 空态图标：收件箱（与 Worker 列表语义一致） */
const EMPTY_ICON =
  'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z'

export default function WorkerTable({
  workers,
  onDelete,
  onManageBindings,
  onDeploy,
  deletingName,
  onRowClick,
}: WorkerTableProps) {
  const columns: DataTableColumn<Worker>[] = [
    {
      key: 'name',
      header: '名称',
      sortable: true,
      value: (worker) => worker.name,
      render: (worker) => (
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
          <span className="text-text-main font-medium">{worker.name}</span>
        </div>
      ),
    },
    {
      key: 'created_on',
      header: '创建时间',
      sortable: true,
      value: (worker) => formatDateTime(worker.created_on),
      render: (worker) => (
        <span className="text-text-muted">{formatDateTime(worker.created_on)}</span>
      ),
    },
    {
      key: 'updated_on',
      header: '修改时间',
      sortable: true,
      value: (worker) => formatDateTime(worker.updated_on),
      render: (worker) => (
        <span className="text-text-muted">{formatDateTime(worker.updated_on)}</span>
      ),
    },
    {
      key: 'routes',
      header: '路由',
      value: (worker) => (worker.routes || []).map((r) => r.pattern || '').join(' '),
      render: (worker) => {
        const routes = worker.routes || []
        if (routes.length === 0) {
          return <span className="text-text-faint">-</span>
        }
        return (
          <div className="flex flex-wrap gap-1">
            {routes.slice(0, 2).map((r, i) => (
              <span
                key={i}
                className="px-2 py-0.5 text-xs rounded bg-surface-3 text-text-muted font-mono"
              >
                {r.pattern}
              </span>
            ))}
            {routes.length > 2 && (
              <span className="px-2 py-0.5 text-xs rounded bg-surface-3 text-text-faint">
                +{routes.length - 2}
              </span>
            )}
          </div>
        )
      },
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      stopRowClick: true,
      searchable: false,
      render: (worker) => (
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
            部署
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
            绑定
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
            删除
          </Button>
        </div>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={workers}
      rowKey={(worker) => worker.id}
      onRowClick={onRowClick ? (worker) => onRowClick(worker.name) : undefined}
      searchPlaceholder="搜索 Worker 名称"
      pageSize={20}
      emptyTitle="还没有 Worker"
      emptyDescription="创建第一个 Worker 后，它会显示在这里。"
      emptyIcon={EMPTY_ICON}
    />
  )
}
