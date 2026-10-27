import Button from '../ui/Button'
import DataTable, { DataTableColumn } from '../ui/DataTable'
import { formatDateTime } from '../../lib/datetime'

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
  onRowClick?: (name: string) => void
}

/** 空态图标：地球（与 Pages 项目语义一致） */
const EMPTY_ICON =
  'M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418'

export default function ProjectTable({
  projects,
  onDelete,
  onDeploy,
  deletingName,
  deployingName,
  onRowClick,
}: ProjectTableProps) {
  const columns: DataTableColumn<PagesProject>[] = [
    {
      key: 'name',
      header: '项目名称',
      sortable: true,
      value: (project) => project.name,
      render: (project) => (
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
                d={EMPTY_ICON}
              />
            </svg>
          </div>
          <span className="text-text-main font-medium">{project.name}</span>
        </div>
      ),
    },
    {
      key: 'created_on',
      header: '创建时间',
      sortable: true,
      value: (project) => formatDateTime(project.created_on),
      render: (project) => (
        <span className="text-text-muted">{formatDateTime(project.created_on)}</span>
      ),
    },
    {
      key: 'domains',
      header: '域名',
      value: (project) => (project.domains || []).join(' '),
      render: (project) =>
        project.domains && project.domains.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {project.domains.slice(0, 2).map((domain, idx) => (
              <span
                key={idx}
                className="px-2 py-0.5 text-xs rounded bg-surface-3 text-text-main font-mono"
              >
                {domain}
              </span>
            ))}
            {project.domains.length > 2 && (
              <span className="px-2 py-0.5 text-xs rounded bg-surface-3 text-text-muted">
                +{project.domains.length - 2}
              </span>
            )}
          </div>
        ) : (
          <span className="text-sm text-text-faint">-</span>
        ),
    },
    {
      key: 'functions',
      header: 'Functions',
      sortable: true,
      value: (project) => (project.uses_functions ? '已启用' : '未启用'),
      render: (project) =>
        project.uses_functions ? (
          <span className="px-2 py-0.5 text-xs rounded bg-green-500/10 text-green-400 border border-green-500/30">
            已启用
          </span>
        ) : (
          <span className="text-sm text-text-faint">未启用</span>
        ),
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      stopRowClick: true,
      searchable: false,
      render: (project) => (
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
            部署
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
            删除
          </Button>
        </div>
      ),
    },
  ]

  return (
    <DataTable
      columns={columns}
      rows={projects}
      rowKey={(project) => project.id}
      onRowClick={onRowClick ? (project) => onRowClick(project.name) : undefined}
      searchPlaceholder="搜索 Pages 项目名称或域名"
      pageSize={20}
      emptyTitle="还没有 Pages 项目"
      emptyDescription="创建第一个 Pages 项目后，它会显示在这里。"
      emptyIcon={EMPTY_ICON}
    />
  )
}
