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
      setError('两次输入的密码不一致')
      return
    }

    if (password.length < 8) {
      setError('密码至少需要 8 个字符')
      return
    }

    setLoading(true)

    try {
      await setup(password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : '初始化失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface text-text-main flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-surface-2 rounded-xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-cf-orange mb-2">欢迎使用 MultiWorker</h1>
            <p className="text-text-muted">设置管理员密码即可开始使用</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="password"
              type="password"
              label="设置密码"
              placeholder="输入一个安全密码（至少 8 个字符）"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />

            <Input
              id="confirmPassword"
              type="password"
              label="确认密码"
              placeholder="再次输入密码"
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
              完成设置
            </Button>
          </form>

          <p className="mt-6 text-sm text-text-faint text-center">
            该密码用于登录 MultiWorker，之后可在「设置」中修改。
          </p>
        </div>
      </div>
    </div>
  )
}
