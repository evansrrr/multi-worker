import { useEffect, useRef } from 'react'

interface ModalProps {
  open: boolean
  title: React.ReactNode
  /** 标题下可选副文案 */
  subtitle?: React.ReactNode
  onClose: () => void
  /** 遮罩点击 / Esc 关闭是否允许（请求进行中应传 false） */
  closable?: boolean
  /** 面板宽度类，默认 max-w-lg */
  maxWidth?: string
  /** z-index 层级类，默认 z-50（嵌套弹窗传 z-[60]） */
  zClass?: string
  children: React.ReactNode
}

/**
 * Modal 基础组件（阶段3 / M11）。
 * 统一提供：遮罩、Esc 关闭、焦点圈定（focus trap）、aria-modal/role="dialog"、
 * 打开时锁定 body 滚动、关闭后焦点归还触发元素。
 */
export default function Modal({
  open,
  title,
  subtitle,
  onClose,
  closable = true,
  maxWidth = 'max-w-lg',
  zClass = 'z-50',
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previousFocus.current = document.activeElement as HTMLElement | null

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closable) {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      // 焦点圈定：Tab / Shift+Tab 在面板内循环
      const panel = panelRef.current
      if (!panel) return
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusables.length === 0) return
      const first = focusables.item(0)
      const last = focusables.item(focusables.length - 1)
      if (!first || !last) return
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panel.contains(active))) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    // 打开后把焦点移入面板
    const t = window.setTimeout(() => {
      const panel = panelRef.current
      if (!panel) return
      const target = panel.querySelector<HTMLElement>('[data-autofocus]') ||
        panel.querySelector<HTMLElement>('input, textarea, button')
      target?.focus()
    }, 0)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(t)
      document.body.style.overflow = prevOverflow
      previousFocus.current?.focus?.()
    }
  }, [open, closable, onClose])

  if (!open) return null

  return (
    <div className={`fixed inset-0 ${zClass} flex items-center justify-center`}>
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => closable && onClose()}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`relative bg-surface-2 rounded-xl p-6 w-full ${maxWidth} shadow-2xl border border-border-subtle mx-4`}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-text-main">{title}</h2>
            {subtitle && <p className="text-sm text-text-muted mt-1">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={() => closable && onClose()}
            disabled={!closable}
            aria-label="关闭"
            className="text-text-muted hover:text-text-main transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
