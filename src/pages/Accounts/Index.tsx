import { useState, useEffect } from 'react'
import AccountCard from '../../components/accounts/AccountCard'
import AddAccountModal from '../../components/accounts/AddAccountModal'
import Button from '../../components/ui/Button'

interface Account {
  id: string
  name: string
  email?: string
  type?: string
}

export default function Accounts() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts')
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setAccounts(data.accounts || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  const handleAddAccount = async (token: string, name?: string) => {
    const response = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, name }),
    })

    const data = await response.json()

    if (data.error) {
      throw new Error(data.error)
    }

    if (data.account) {
      setAccounts((prev) => [...prev, data.account])
    }
  }

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Are you sure you want to remove this account?')) {
      return
    }

    setDeletingId(id)
    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setAccounts((prev) => prev.filter((a) => a.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account')
    } finally {
      setDeletingId(null)
    }
  }

  const handleManageAccount = (id: string) => {
    window.location.href = `/accounts/${id}/workers`
  }

  return (
    <div className="min-h-screen bg-cf-dark-900 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-cf-orange">Accounts</h1>
            <p className="text-gray-400 mt-1">Manage your Cloudflare accounts</p>
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

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => setError('')}
              className="text-sm text-red-400 hover:text-red-300 mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin h-8 w-8 border-4 border-cf-orange border-t-transparent rounded-full" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-cf-dark-800 flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-500"
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
            <h3 className="text-xl font-semibold text-white mb-2">No accounts yet</h3>
            <p className="text-gray-400 mb-6">
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
                onDelete={() => handleDeleteAccount(account.id)}
                deleting={deletingId === account.id}
              />
            ))}
          </div>
        )}
      </div>

      <AddAccountModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddAccount}
      />
    </div>
  )
}
