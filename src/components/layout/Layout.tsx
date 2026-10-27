import { useEffect, useState, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'

interface LayoutProps {
  children: ReactNode
  /**
   * 面包屑（阶段3 / H9）：从左到右的层级，最后一项为当前页（纯文本）。
   * 例：[{ label: '账户', to: '/accounts' }, { label: 'Workers', to: '/accounts/x/workers' }, { label: 'my-worker' }]
   */
  crumbs?: { label: string; to?: string }[]
}

/** <1024px 断点：侧栏收起为抽屉 */
export function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}

function Breadcrumbs({ crumbs }: { crumbs: NonNullable<LayoutProps['crumbs']> }) {
  const navigate = useNavigate()
  return (
    <nav aria-label="面包屑" className="flex items-center gap-1.5 text-sm text-text-muted min-w-0 overflow-x-auto">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={`${crumb.label}-${i}`} className="flex items-center gap-1.5 shrink-0">
            {i > 0 && <span aria-hidden="true" className="text-text-faint">/</span>}
            {isLast || !crumb.to ? (
              <span className="text-text-main font-medium truncate max-w-[40vw] lg:max-w-none">{crumb.label}</span>
            ) : (
              <button
                type="button"
                onClick={() => navigate(crumb.to!)}
                className="hover:text-text-main transition-colors truncate max-w-[30vw] lg:max-w-none"
              >
                {crumb.label}
              </button>
            )}
          </span>
        )
      })}
    </nav>
  )
}

export default function Layout({ children, crumbs }: LayoutProps) {
  const isDesktop = useIsDesktop()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // 切换到桌面宽度时收起抽屉
  useEffect(() => {
    if (isDesktop) setDrawerOpen(false)
  }, [isDesktop])

  return (
    <div className="min-h-screen bg-surface text-text-main">
      {/* 移动端顶栏：汉堡 + 面包屑 */}
      {!isDesktop && (
        <div className="sticky top-0 z-30 flex items-center gap-3 h-14 px-4 bg-surface-2 border-b border-border-subtle">
          <button
            type="button"
            aria-label="打开导航菜单"
            onClick={() => setDrawerOpen(true)}
            className="p-2 -ml-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface-3"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {crumbs && crumbs.length > 0 && <Breadcrumbs crumbs={crumbs} />}
        </div>
      )}

      <Sidebar
        variant={isDesktop ? 'fixed' : 'drawer'}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
      />

      <div className="flex flex-col min-h-screen lg:ml-[260px]">
        {isDesktop && (
          <header className="h-16 shrink-0 bg-surface-2 border-b border-border-subtle flex items-center px-6">
            {crumbs && crumbs.length > 0 ? (
              <Breadcrumbs crumbs={crumbs} />
            ) : (
              <span className="text-sm text-text-muted">Cloudflare 资源管理</span>
            )}
          </header>
        )}
        <main className="flex-1 p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
