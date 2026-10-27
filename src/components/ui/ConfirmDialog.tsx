import { useEffect, useRef, useState } from 'react'
import Button from './Button'
import Modal from './Modal'

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
 * Modal 基座提供焦点圈定 / aria / 滚动锁。
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
    if (!open) setTyped('')
  }, [open])

  const nameOk = !requireName || typed.trim() === requireName

  return (
    <Modal open={open} title={title} onClose={onClose} closable={!loading} maxWidth="max-w-md">
      <div className="text-text-muted text-sm mb-4">{message}</div>

      {requireName && (
        <div className="mb-4">
          <label className="block text-sm font-medium text-text-muted mb-1">
            请输入 <span className="font-mono text-cf-orange">{requireName}</span> 以确认
          </label>
          <input
            ref={inputRef}
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={requireName}
            disabled={loading}
            data-autofocus
            className="w-full px-3 py-2 bg-surface-3 border border-border-strong rounded-lg text-text-main placeholder-text-faint focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent font-mono text-sm"
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
    </Modal>
  )
}
