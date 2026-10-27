import { useEffect, useRef, useState } from 'react'
import Button from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: React.ReactNode
  confirmText?: string
  cancelText?: string
  /** Red confirm button for destructive actions. */
  danger?: boolean
  /**
   * When set, the user must type this exact string (e.g. the resource name)
   * before the confirm button enables. Required for destructive operations.
   */
  requireName?: string
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

/**
 * Unified confirmation dialog replacing native confirm().
 * Esc closes; destructive actions can require typing the resource name.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  requireName,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [typed, setTyped] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      setTyped('')
      return
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    if (requireName) inputRef.current?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, loading, onClose, requireName])

  if (!open) return null

  const nameOk = !requireName || typed.trim() === requireName

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !loading && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative bg-cf-dark-800 rounded-xl p-6 w-full max-w-md shadow-2xl border border-cf-dark-700 mx-4"
      >
        <h2 className="text-xl font-bold text-white mb-3">{title}</h2>
        <div className="text-gray-300 text-sm mb-4">{message}</div>

        {requireName && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              请输入 <span className="font-mono text-cf-orange">{requireName}</span> 以确认
            </label>
            <input
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={requireName}
              disabled={loading}
              className="w-full px-3 py-2 bg-cf-dark-700 border border-cf-dark-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent font-mono text-sm"
            />
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loading}
            className="flex-1"
          >
            {cancelText}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={!nameOk || loading}
            loading={loading}
            className="flex-1"
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
