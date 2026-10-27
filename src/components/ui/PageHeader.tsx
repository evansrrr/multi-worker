import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  /** 右上角操作区（新建、刷新等按钮） */
  actions?: ReactNode
}

/**
 * 统一页头（阶段3 收尾 / L1）。
 *
 * 之前 Dashboard 用 text-2xl text-white、其他页用 text-3xl text-cf-orange，
 * 层级不统一。这里固定为 text-2xl + 品牌色标题 + 次级描述 + 右侧操作区。
 */
export default function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-cf-orange truncate">{title}</h1>
        {description && <p className="text-text-muted text-sm mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
