import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function Setup() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setup } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setLoading(true)

    try {
      await setup(password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-cf-dark-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-cf-dark-800 rounded-xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-cf-orange mb-2">Welcome to MultiWorker</h1>
            <p className="text-gray-400">Set up your admin password to get started</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="password"
              type="password"
              label="Create Password"
              placeholder="Enter a secure password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />

            <Input
              id="confirmPassword"
              type="password"
              label="Confirm Password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={error}
            />

            <Button
              type="submit"
              className="w-full"
              loading={loading}
              disabled={!password || !confirmPassword}
            >
              Create Account
            </Button>
          </form>

          <p className="mt-6 text-sm text-gray-500 text-center">
            This password will be used to access your Cloudflare management dashboard.
          </p>
        </div>
      </div>
    </div>
  )
}
