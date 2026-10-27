import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AccountCard from '../../components/accounts/AccountCard'
import AddAccountModal from '../../components/accounts/AddAccountModal'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import ErrorBanner from '../../components/ui/ErrorBanner'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import EmptyState from '../../components/ui/EmptyState'
import LoadingBlock from '../../components/ui/LoadingBlock'
import PageHeader from '../../components/ui/PageHeader'
import { apiGet, apiPost, apiPut, apiDelete } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

interface Account {
  id: string
  name: string
  email?: string
  type?: string
}

/**
 * POST /api/accounts/{id}/verify 的响应体。
 * 现有实现返回 `{ valid, email? }` / `{ valid: false, error }`；改版后统一为
 * `{ ok, accountName? }` / `{ ok: false, reason }`。两种字段都读，后端迁移时前端不用改。
 */
interface VerifyResult {
  valid?: boolean
  ok?: boolean
  email?: string
  accountName?: string
  error?: string
  reason?: string
}

export default function Accounts() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<Account | null>(null)
  const { addToast } = useToast()

  const fetchAccounts = async () => {
    try {
      const data = await apiGet<{ accounts?: Account[] }>('/api/accounts')
      setAccounts(data.accounts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载账户列表失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  const handleAddAccount = async (payload: {
    token: string
    accounts?: Array<{ id: string; name?: string }>
  }) => {
    // 弹窗表单内联展示错误，关闭自动 toast 避免双份反馈
    const data = await apiPost<{
      accounts?: Account[]
      updated?: string[]
      skipped?: Array<{ id: string; reason: string }>
    }>('/api/accounts', payload, { silent: true })

    if (data.accounts && data.accounts.length > 0) {
      setAccounts((prev) => {
        const next = [...prev]
        for (const added of data.accounts!) {
          const idx = next.findIndex((a) => a.id === added.id)
          if (idx >= 0) next[idx] = added
          else next.push(added)
        }
        return next
      })
      const updated = data.updated?.length ?? 0
      const skipped = data.skipped?.length ?? 0
      const parts = [`已添加 ${data.accounts.length} 个账户`]
      if (updated > 0) parts.push(`${updated} 个覆盖更新`)
      if (skipped > 0) parts.push(`${skipped} 个跳过`)
      addToast(parts.join('，'), 'success')
    }
  }

  const confirmDeleteAccount = async () => {
    if (!deleteTarget) return
    const { id } = deleteTarget

    setDeletingId(id)
    try {
      await apiDelete(`/api/accounts/${id}`)
      setAccounts((prev) => prev.filter((a) => a.id !== id))
      addToast('账户已删除', 'success')
      setDeleteTarget(null)
    } catch {
      // api() 已自动弹错误 toast；保持确认框打开以便重试
    } finally {
      setDeletingId(null)
    }
  }

  const handleManageAccount = (id: string) => {
    navigate(`/accounts/${id}/workers`)
  }

  /** 修改账户展示别名（只改本地 name，不改 CF 侧真实账户名）。 */
  const handleRenameAccount = async (newName: string) => {
    if (!renameTarget) return
    const data = await apiPut<{ account?: Account }>(
      `/api/accounts/${renameTarget.id}`,
      { name: newName },
      { silent: true }
    )
    if (data.account) {
      setAccounts((prev) =>
        prev.map((a) => (a.id === renameTarget.id ? { ...a, name: data.account!.name } : a))
      )
      addToast('账户名称已更新', 'success')
    }
  }

  /** 重新校验：确认已保存的 API Token 仍能访问该账户 */
  const handleVerifyAccount = async (id: string) => {
    if (verifyingId) return
    setVerifyingId(id)

    try {
      // 失败原因要展示在卡片旁/toast 里，关闭自动 toast 由本函数统一发
      const data = await apiPost<VerifyResult>(
        `/api/accounts/${id}/verify`,
        undefined,
        { silent: true }
      )

      if (data.valid === false || data.ok === false) {
        addToast(data.error || data.reason || '校验失败', 'error')
      } else {
        addToast('校验通过', 'success')
      }
    } catch (err) {
      // 401/500 等由 api() 抛出的 ApiError，message 即后端 error 字段
      addToast(err instanceof Error ? err.message : '校验失败', 'error')
    } finally {
      setVerifyingId(null)
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <PageHeader
        title="账户"
        description="管理你的 Cloudflare 账户与 API Token"
        actions={
          <Button onClick={() => setShowAddModal(true)}>
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4v16m8-8H4"
              />
            </svg>
            添加账户
          </Button>
        }
      />

      <ErrorBanner error={error} onDismiss={() => setError('')} />

      {loading ? (
        <LoadingBlock label="正在加载账户" rows={6} />
      ) : accounts.length === 0 ? (
        <EmptyState
          icon="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          title="还没有账户"
          description="添加第一个 Cloudflare 账户，即可管理 Workers、Pages、KV 与 D1 资源。"
          action={<Button onClick={() => setShowAddModal(true)}>添加账户</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              id={account.id}
              name={account.name}
              email={account.email}
              type={account.type}
              onManage={() => handleManageAccount(account.id)}
              onDelete={() => setDeleteTarget(account)}
              deleting={deletingId === account.id}
              onVerify={() => handleVerifyAccount(account.id)}
              verifying={verifyingId === account.id}
              onRename={() => setRenameTarget(account)}
            />
          ))}
        </div>
      )}

      <AddAccountModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddAccount}
      />

      <RenameAccountModal
        account={renameTarget}
        onClose={() => setRenameTarget(null)}
        onRename={handleRenameAccount}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除账户"
        message={
          <>
            确定要删除账户{' '}
            <span className="font-mono text-cf-orange">{deleteTarget?.name}</span>{' '}
            吗？删除后该账户的凭据将被移除，此操作不可恢复。
          </>
        }
        confirmText="删除"
        danger
        requireName={deleteTarget?.name}
        loading={deletingId !== null}
        onConfirm={confirmDeleteAccount}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  )
}

function RenameAccountModal({
  account,
  onClose,
  onRename,
}: {
  account: Account | null
  onClose: () => void
  onRename: (name: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 打开时用当前账户名预填
  useEffect(() => {
    if (account) {
      setName(account.name)
      setError('')
    }
  }, [account])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('名称不能为空')
      return
    }
    setSaving(true)
    setError('')
    try {
      await onRename(trimmed)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={account !== null}
      title="编辑账户名称"
      onClose={onClose}
      closable={!saving}
      maxWidth="max-w-sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="rename-account"
          label="账户名称"
          placeholder="我的 Cloudflare 账户"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving} className="flex-1">
            取消
          </Button>
          <Button type="submit" loading={saving} disabled={!name.trim()} className="flex-1">
            保存
          </Button>
        </div>
      </form>
    </Modal>
  )
}
