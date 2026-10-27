import { useState } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Modal from '../ui/Modal'
import ErrorBanner from '../ui/ErrorBanner'
import { apiPost } from '../../lib/api'

interface PreviewAccount {
  id: string
  name: string
  type: string
  alreadyAdded: boolean
}

interface AddAccountModalProps {
  open: boolean
  onClose: () => void
  /** 批量导入：accounts 省略表示"导入全部可见账户"。 */
  onAdd: (payload: {
    token: string
    accounts?: Array<{ id: string; name?: string }>
  }) => Promise<void>
}

/**
 * 添加账户（M4）：两步流程。
 * 第一步输入 token 并"预检"，拿到该 token 可见的全部账户后多选；
 * 第二步确认导入（可"导入选中"或"导入全部"）。
 */
export default function AddAccountModal({ open, onClose, onAdd }: AddAccountModalProps) {
  const [token, setToken] = useState('')
  const [previewing, setPreviewing] = useState(false)
  const [candidates, setCandidates] = useState<PreviewAccount[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const busy = previewing || submitting

  const reset = () => {
    setToken('')
    setCandidates(null)
    setSelectedIds(new Set())
    setError('')
    setPreviewing(false)
    setSubmitting(false)
  }

  const handleClose = () => {
    if (!busy) {
      reset()
      onClose()
    }
  }

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setCandidates(null)
    setSelectedIds(new Set())
    setPreviewing(true)
    try {
      // silent: 预检失败在此内联展示
      const data = await apiPost<{ accounts?: PreviewAccount[] }>(
        '/api/accounts/preview',
        { token },
        { silent: true }
      )
      const list = data.accounts || []
      if (list.length === 0) {
        setError('该 Token 看不到任何账户')
        return
      }
      setCandidates(list)
      // 默认全选（尚未添加的）
      setSelectedIds(new Set(list.filter((c) => !c.alreadyAdded).map((c) => c.id)))
    } catch (err) {
      setError(err instanceof Error ? err.message : '预检失败')
    } finally {
      setPreviewing(false)
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allSelected =
    candidates !== null &&
    candidates.length > 0 &&
    candidates.every((c) => selectedIds.has(c.id))

  const handleImport = async (importAll: boolean) => {
    setError('')
    setSubmitting(true)
    try {
      if (importAll) {
        await onAdd({ token })
      } else {
        const accounts = (candidates || [])
          .filter((c) => selectedIds.has(c.id))
          .map((c) => ({ id: c.id }))
        await onAdd({ token, accounts })
      }
      reset()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '导入失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      title="添加账户"
      onClose={handleClose}
      closable={!busy}
      maxWidth="max-w-lg"
    >
      {candidates === null ? (
        <form onSubmit={handlePreview} className="space-y-4">
          <Input
            id="account-token"
            label="API Token"
            type="password"
            placeholder="输入 Cloudflare API Token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoFocus
          />

          <div className="bg-surface-inset border border-border-subtle rounded-lg p-3">
            <p className="text-xs text-text-muted">
              Token 需具备{' '}
              <span className="font-semibold text-text-main">Account - Workers（编辑）</span>
              {' '}或{' '}
              <span className="font-semibold text-text-main">所有资源</span> 权限。
              预检后会列出该 Token 可见的全部账户，供你选择导入。
            </p>
            <a
              href="https://dash.cloudflare.com/profile/api-tokens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-cf-orange underline hover:opacity-80 mt-1 inline-block"
            >
              前往创建 API Token →
            </a>
          </div>

          <ErrorBanner error={error} onDismiss={() => setError('')} />

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={busy}
              className="flex-1"
            >
              取消
            </Button>
            <Button type="submit" loading={previewing} disabled={!token} className="flex-1">
              预检账户
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-text-muted">
            该 Token 可见 {candidates.length} 个账户，勾选要导入的账户（已导入的会覆盖凭据）：
          </p>

          <div className="max-h-64 overflow-y-auto rounded-lg border border-border-subtle divide-y divide-border-subtle">
            {candidates.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-surface-3/30"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(c.id)}
                  onChange={() => toggleSelect(c.id)}
                  aria-label={`选择账户 ${c.name}`}
                  className="w-4 h-4 rounded border-border-strong bg-surface-3 text-cf-orange focus:ring-cf-orange/50"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-main truncate">{c.name}</p>
                  <p className="text-xs text-text-faint font-mono truncate">{c.id}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-3 text-text-muted shrink-0">
                  {c.type}
                </span>
                {c.alreadyAdded && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 shrink-0">
                    已导入
                  </span>
                )}
              </label>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() =>
                setSelectedIds(
                  allSelected
                    ? new Set()
                    : new Set(candidates.map((c) => c.id))
                )
              }
              className="text-sm text-text-muted hover:text-text-main"
            >
              {allSelected ? '取消全选' : '全选'}
            </button>
            <p className="text-xs text-text-faint">已选 {selectedIds.size} 个</p>
          </div>

          <ErrorBanner error={error} onDismiss={() => setError('')} />

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCandidates(null)
                setSelectedIds(new Set())
                setError('')
              }}
              disabled={busy}
              className="flex-1"
            >
              重新输入
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleImport(false)}
              disabled={selectedIds.size === 0 || busy}
              loading={submitting}
              className="flex-1"
            >
              导入选中
            </Button>
            <Button
              type="button"
              onClick={() => handleImport(true)}
              disabled={busy}
              className="flex-1"
            >
              导入全部
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
