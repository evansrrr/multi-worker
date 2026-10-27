import { ReactNode, useMemo, useState } from 'react'
import Button from './Button'
import EmptyState from './EmptyState'

export interface DataTableColumn<T> {
  key: string
  header: string
  /** 单元格渲染；不传则取 value(row) 的结果作为文本 */
  render?: (row: T) => ReactNode
  /** 该列的原始文本值，用于搜索与排序 */
  value?: (row: T) => string
  sortable?: boolean
  align?: 'left' | 'right'
  /** 操作列需置 true：点击单元格时不触发行点击（避免点按钮误进详情） */
  stopRowClick?: boolean
  /** 该列是否参与关键词搜索，默认参与 */
  searchable?: boolean
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
  loading?: boolean
  /** 搜索框占位文案；不传则不显示搜索框 */
  searchPlaceholder?: string
  /** 每页条数，默认 20 */
  pageSize?: number
  emptyTitle?: string
  emptyDescription?: string
  emptyIcon?: string
  /** 搜索框左侧的额外筛选控件（类型筛选等） */
  toolbar?: ReactNode
}

/**
 * 统一数据表格（阶段3 收尾 / L3）：关键词搜索 + 排序 + 分页。
 *
 * 设计约束：
 * - 纯客户端处理。各列表页单页数据量有限（服务端已按 per_page 拉取），
 *   不必引入服务端分页协议。
 * - 筛选逻辑是纯函数（先过滤 → 再排序 → 再分页），便于推理与测试。
 */
export default function DataTable<T>({
  columns,
  rows,
  rowKey,
  onRowClick,
  loading = false,
  searchPlaceholder,
  pageSize = 20,
  emptyTitle = '暂无数据',
  emptyDescription,
  emptyIcon,
  toolbar,
}: DataTableProps<T>) {
  const [keyword, setKeyword] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  const searchableColumns = useMemo(
    () => columns.filter((c) => c.searchable !== false),
    [columns]
  )

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return rows

    return rows.filter((row) =>
      searchableColumns.some((col) => {
        const raw = col.value ? col.value(row) : ''
        return raw.toLowerCase().includes(kw)
      })
    )
  }, [rows, keyword, searchableColumns])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const col = columns.find((c) => c.key === sortKey)
    if (!col?.value) return filtered

    const factor = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const va = col.value!(a).toLowerCase()
      const vb = col.value!(b).toLowerCase()
      return va < vb ? -factor : va > vb ? factor : 0
    })
  }, [filtered, sortKey, sortDir, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  // 数据变化后当前页可能越界，钳制到最后一页
  const currentPage = Math.min(page, totalPages)

  const paged = useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize]
  )

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
    setPage(1)
  }

  return (
    <div>
      {(searchPlaceholder || toolbar) && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border-subtle">
          {toolbar}
          {searchPlaceholder && (
            <div className="relative ml-auto w-full sm:w-64">
              <svg
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="search"
                value={keyword}
                onChange={(e) => {
                  setKeyword(e.target.value)
                  setPage(1)
                }}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full pl-9 pr-3 py-1.5 text-sm bg-surface-3 border border-border-strong rounded-lg text-text-main placeholder-text-faint focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent"
              />
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin h-6 w-6 border-2 border-cf-orange border-t-transparent rounded-full" />
        </div>
      ) : paged.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} icon={emptyIcon} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`py-3 px-4 text-sm font-medium text-text-muted ${
                      col.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                    aria-sort={
                      sortKey === col.key
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-text-main transition-colors"
                      >
                        {col.header}
                        <span aria-hidden="true" className="text-xs">
                          {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-border-subtle/50 transition-colors ${
                    onRowClick ? 'cursor-pointer hover:bg-surface-3/30' : ''
                  }`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      onClick={
                        col.stopRowClick ? (e) => e.stopPropagation() : undefined
                      }
                      className={`py-3 px-4 text-sm ${
                        col.align === 'right' ? 'text-right' : ''
                      }`}
                    >
                      {col.render ? col.render(row) : col.value ? col.value(row) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border-subtle">
          <span className="text-sm text-text-muted">
            共 {sorted.length} 条，第 {currentPage}/{totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={currentPage <= 1}
              onClick={() => setPage(currentPage - 1)}
              className="text-sm px-3 py-1"
            >
              上一页
            </Button>
            <Button
              variant="secondary"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(currentPage + 1)}
              className="text-sm px-3 py-1"
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
