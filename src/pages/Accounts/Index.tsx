import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AccountCard from '../../components/accounts/AccountCard'
import AddAccountModal from '../../components/accounts/AddAccountModal'
import Button from '../../components/ui/Button'
import ErrorBanner from '../../components/ui/ErrorBanner'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { apiGet, apiPost, apiDelete } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

interface Account {
  id: string
  name: string
  email?: string
  type?: string
}

/**
 * AddAccountModal 展示的“创建 API Token”提示框是从抛出错误的 message 里解析
 * `hint:` 得到的。api() 只透出 `error` 字符串，这里按后端 POST /api/accounts
 * 的两类错误补回 hint，保持弹窗提示行为不变。
 */
const ACCOUNT_ERROR_HINTS: Array<[string, string]> = [
  [
    'Token verification failed',
    "Please create an API Token at https://dash.cloudflare.com/profile/api-tokens with 'Edit Cloudflare Workers' or 'All Resources' permissions",
  ],
  [
    'No accounts found',
    "Make sure your token has 'Account - Workers' or 'All Resources' permissions",
  ],
]

function toAddAccountError(err: unknown): Error {
  const message = err instanceof Error ? err.message : '添加账户失败'
  const matched = ACCOUNT_ERROR_HINTS.find(([prefix]) => message.startsWith(prefix))
  return new Error(matched ? `${message} hint: ${matched[1]}` : message)
}

export default function Accounts() {
  const navigate = useNavigate()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Account | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
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

  const handleAddAccount = async (token: string, name?: string) => {
    try {
      const data = await apiPost<{ account?: Account }>(
        '/api/accounts',
        { token, name },
        // 弹窗表单内联展示错误（含 hint），关闭自动 toast 避免双份反馈
        { silent: true }
      )

      if (data.account) {
        setAccounts((prev) => [...prev, data.account as Account])
        addToast('账户已添加', 'success')
      }
    } catch (err) {
      // AddAccountModal 会捕获并内联展示，这里把 hint 拼回 message
      throw toAddAccountError(err)
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

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-cf-orange">Accounts</h1>
          <p className="text-text-muted mt-1">Manage your Cloudflare accounts</p>
        </div>
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
            Add Account
          </Button>
        </div>

        <ErrorBanner error={error} onDismiss={() => setError('')} />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-cf-orange border-t-transparent rounded-full" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-text-faint"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-text-main mb-2">No accounts yet</h3>
            <p className="text-text-muted mb-6">
              Add your first Cloudflare account to get started.
            </p>
            <Button onClick={() => setShowAddModal(true)}>
              Add Your First Account
            </Button>
          </div>
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
              />
            ))}
          </div>
        )}

      <AddAccountModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddAccount}
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
