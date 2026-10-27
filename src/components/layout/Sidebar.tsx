import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { apiGet } from '../../lib/api'
import { Account } from '../../types'

const globalNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
  { name: 'Accounts', href: '/accounts', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
]

/** 账户内二级导航（阶段3 / H9） */
const accountTabs = [
  { name: 'Workers', segment: 'workers' },
  { name: 'Pages', segment: 'pages' },
  { name: 'KV', segment: 'kv' },
  { name: 'D1', segment: 'd1' },
]

function SidebarIcon({ path }: { path: string }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
    </svg>
  )
}

interface SidebarProps {
  /** fixed：桌面常驻侧栏；drawer：移动端抽屉 */
  variant: 'fixed' | 'drawer'
  open?: boolean
  onClose?: () => void
}

export default function Sidebar({ variant, open = false, onClose }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<Account[]>([])

  // 从路径解析当前账户上下文：/accounts/:accountId/...
  const match = location.pathname.match(/^\/accounts\/([^/]+)(\/|$)/)
  const accountId = match && match[1] !== 'new' ? match[1] : null
  const accountSegment = location.pathname.match(/^\/accounts\/[^/]+\/([^/]+)/)?.[1] ?? null

  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await apiGet<{ accounts?: Account[] }>('/api/accounts')
        if (!cancelled) setAccounts(data.accounts || [])
      } catch {
        // 账户名获取失败不阻塞导航
      }
    })()
    return () => { cancelled = true }
  }, [accountId])

  const currentAccount = accounts.find((a) => a.id === accountId)

  const isDrawer = variant === 'drawer'
  const baseClass = isDrawer
    ? `fixed inset-y-0 left-0 z-40 w-[260px] transform transition-transform duration-200 ease-out ${open ? 'translate-x-0' : '-translate-x-full'}`
    : 'fixed inset-y-0 left-0 w-[260px]'

  return (
    <>
      {/* 移动端遮罩 */}
      {isDrawer && open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div className={`${baseClass} bg-surface-2 border-r border-border-subtle flex flex-col`}>
        {/* Logo / Branding */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-border-subtle">
          <button
            type="button"
            onClick={() => { navigate('/dashboard'); onClose?.() }}
            className="flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-cf-orange flex items-center justify-center">
              {/* 品牌标识：底色恒为 cf-orange，图标恒白，不随主题切换 */}
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="text-lg font-bold text-text-main">MultiWorker</span>
          </button>
          {isDrawer && (
            <button
              type="button"
              aria-label="关闭导航菜单"
              onClick={onClose}
              className="p-1 rounded text-text-muted hover:text-text-main"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* 全局导航 */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {globalNavigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-cf-orange/10 text-cf-orange'
                    : 'text-text-muted hover:text-text-main hover:bg-surface-3'
                }`
              }
            >
              <SidebarIcon path={item.icon} />
              {item.name}
            </NavLink>
          ))}

          {/* 账户上下文：当前账户 + 二级 Tab（H9） */}
          {accountId && (
            <div className="pt-4 mt-2 border-t border-border-subtle">
              <div className="px-3 pb-2">
                <p className="text-xs text-text-faint uppercase tracking-wide">当前账户</p>
                <p className="text-sm font-medium text-text-main truncate">
                  {currentAccount?.name || accountId}
                </p>
              </div>
              <div className="space-y-1">
                {accountTabs.map((tab) => {
                  const href = `/accounts/${accountId}/${tab.segment}`
                  const active = accountSegment === tab.segment
                  return (
                    <NavLink
                      key={tab.segment}
                      to={href}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                        active
                          ? 'bg-cf-orange/10 text-cf-orange font-medium'
                          : 'text-text-muted hover:text-text-main hover:bg-surface-3'
                      }`}
                    >
                      {tab.name}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle">
          <div className="flex items-center gap-2 text-xs text-text-faint">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <span>Cloudflare Management</span>
          </div>
        </div>
      </div>
    </>
  )
}
