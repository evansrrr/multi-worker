import { useState, useEffect } from 'react'
import Layout from '../../components/layout/Layout'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

type AppearanceMode = 'light' | 'dark' | 'system'

const APPEARANCE_OPTIONS: { value: AppearanceMode; label: string; description: string }[] = [
  { value: 'light', label: 'Light', description: 'Always use light theme' },
  { value: 'dark', label: 'Dark', description: 'Always use dark theme' },
  { value: 'system', label: 'System', description: 'Follow system preference' },
]

export default function Settings() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-cf-orange">Settings</h1>
          <p className="text-gray-400 mt-1">Manage your application settings</p>
        </div>

        <AppearanceSection />
        <PasswordSection />
      </div>
    </Layout>
  )
}

function AppearanceSection() {
  const [mode, setMode] = useState<AppearanceMode>('system')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchAppearance = async () => {
    try {
      const response = await fetch('/api/settings/appearance')
      const data = await response.json()
      if (data.mode) setMode(data.mode)
    } catch {
      // ignore
    }
  }

  // Load on mount
  useEffect(() => { fetchAppearance() }, [])

  const handleSave = async (newMode: AppearanceMode) => {
    setMode(newMode)
    setSaving(true)
    setSaved(false)
    try {
      const response = await fetch('/api/settings/appearance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode }),
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // ignore - revert not needed since mode is just a preference
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-cf-dark-800 rounded-xl p-6 border border-cf-dark-700">
      <h2 className="text-lg font-semibold text-white mb-1">Appearance</h2>
      <p className="text-sm text-gray-400 mb-4">Choose your preferred theme</p>

      <div className="grid grid-cols-3 gap-3">
        {APPEARANCE_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleSave(option.value)}
            disabled={saving}
            className={`p-4 rounded-lg border-2 transition-all text-left ${
              mode === option.value
                ? 'border-cf-orange bg-cf-orange/10'
                : 'border-cf-dark-600 hover:border-cf-dark-700 hover:bg-cf-dark-700/50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-3 h-3 rounded-full ${
                mode === option.value ? 'bg-cf-orange' : 'bg-cf-dark-600'
              }`} />
              <span className="text-sm font-medium text-white">{option.label}</span>
            </div>
            <p className="text-xs text-gray-400">{option.description}</p>
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
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

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
      const response = await fetch('/api/settings/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await response.json()
      if (data.error) throw new Error(data.error)

      setSuccess('Password updated successfully')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-cf-dark-800 rounded-xl p-6 border border-cf-dark-700">
      <h2 className="text-lg font-semibold text-white mb-1">Change Password</h2>
      <p className="text-sm text-gray-400 mb-4">Update your admin password</p>

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

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
            <p className="text-sm text-green-400">{success}</p>
          </div>
        )}

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
