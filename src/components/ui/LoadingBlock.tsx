interface LoadingBlockProps {
  /** 文案，默认"加载中" */
  label?: string
  /** 骨架行数，默认 3 */
  rows?: number
}

/**
 * 统一加载态（阶段3 收尾 / L2）。
 *
 * 之前有的页面只有 spinner、有的直接空白。这里统一为 spinner + 骨架条，
 * 让长列表在首次加载时也有稳定的高度占位，避免布局跳动。
 */
export default function LoadingBlock({ label = '加载中', rows = 3 }: LoadingBlockProps) {
  return (
    <div className="py-8" aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-center gap-3 mb-4">
        <div className="animate-spin h-5 w-5 border-2 border-cf-orange border-t-transparent rounded-full" />
        <span className="text-sm text-text-muted">{label}</span>
      </div>
      <div className="space-y-2 max-w-2xl mx-auto" aria-hidden="true">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-4 rounded bg-surface-3 animate-pulse" />
        ))}
      </div>
    </div>
  )
}

/** 仅骨架条，用于卡片内局部加载 */
export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`rounded bg-surface-3 animate-pulse ${className}`} aria-hidden="true" />
}
