import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import ErrorBanner from '../../components/ui/ErrorBanner'
import { apiPut } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { useToast } from '../../hooks/useToast'

type AppearanceMode = 'light' | 'dark' | 'system'

const APPEARANCE_OPTIONS: { value: AppearanceMode; label: string; description: string }[] = [
  { value: 'light', label: 'Light', description: 'Always use light theme' },
  { value: 'dark', label: 'Dark', description: 'Always use dark theme' },
  { value: 'system', label: 'System', description: 'Follow system preference' },
]

export default function Settings() {
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-cf-orange">Settings</h1>
        <p className="text-text-muted mt-1">Manage your application settings</p>
      </div>

      <AppearanceSection />
      <PasswordSection />
    </div>
  )
}

function AppearanceSection() {
  const { appearance, setAppearance } = useTheme()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const handleSave = async (newMode: AppearanceMode) => {
    setSaving(true)
    setSaved(false)
    await setAppearance(newMode)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  return (
    <div className="bg-surface-2 rounded-xl p-6 border border-border-subtle">
      <h2 className="text-lg font-semibold text-text-main mb-1">Appearance</h2>
      <p className="text-sm text-text-muted mb-4">Choose your preferred theme</p>

      <div className="grid grid-cols-3 gap-3">
        {APPEARANCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSave(option.value)}
            disabled={saving}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              appearance === option.value
                ? 'border-cf-orange bg-cf-orange/10'
                : 'border-border-strong hover:border-border-subtle hover:bg-surface-3/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-3 h-3 rounded-full ${
                appearance === option.value ? 'bg-cf-orange' : 'bg-border-strong'
              }`} />
              <span className="text-sm font-medium text-text-main">{option.label}</span>
            </div>
            <p className="text-xs text-text-muted">{option.description}</p>
          </button>
        ))}
      </div>

      {saved && (
        <p className="text-sm text-green-400 mt-3">Appearance updated</p>
      )}
    </div>
  )
}

function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { addToast } = useToast()
  const { logout } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters')
      return
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from current password')
      return
    }

    setLoading(true)
    try {
      await apiPut(
        '/api/settings/password',
        { currentPassword, newPassword },
        // 表单需要内联错误（含客户端校验），关闭自动 toast 保证单通道
        { silent: true }
      )

      // 后端已递增 session_epoch，当前会话同时失效，必须重新登录
      addToast('密码已修改，请重新登录', 'success')
      try {
        // 清理客户端登录态，否则 PublicRoute 会把未登出的客户端弹回 /dashboard
        await logout()
      } catch {
        // 会话已在服务端失效，忽略
      }
      navigate('/login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-surface-2 rounded-xl p-6 border border-border-subtle">
      <h2 className="text-lg font-semibold text-text-main mb-1">Change Password</h2>
      <p className="text-sm text-text-muted mb-4">Update your admin password</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="current-password"
          type="password"
          label="Current Password"
          placeholder="Enter current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          autoFocus
        />

        <Input
          id="new-password"
          type="password"
          label="New Password"
          placeholder="Enter new password (min 8 characters)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />

        <Input
          id="confirm-password"
          type="password"
          label="Confirm New Password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />

        <ErrorBanner error={error} onDismiss={() => setError('')} />

        <Button
          type="submit"
          loading={loading}
          disabled={!currentPassword || !newPassword || !confirmPassword}
        >
          Update Password
        </Button>
      </form>
    </div>
  )
}
