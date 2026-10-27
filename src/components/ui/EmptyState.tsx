import { ReactNode } from 'react'

interface EmptyStateProps {
  /** 简短标题，如"还没有 Worker" */
  title: string
  description?: string
  /** 可选图标（24x24 viewBox 的 path），不传则只显示文案 */
  icon?: string
  /** 主操作，如"创建 Worker" */
  action?: ReactNode
}

/**
 * 统一空态（阶段3 收尾 / L2）。
 *
 * 之前各页面空态各写各的（有的只有一行灰字，有的带图标但尺寸不一）。
 */
export default function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      {icon && (
        <svg
          className="w-12 h-12 text-text-faint mx-auto mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      )}
      <p className="text-text-muted font-medium">{title}</p>
      {description && <p className="text-text-faint text-sm mt-1">{description}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  )
}
