import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(password)
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface text-text-main flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-surface-2 rounded-xl p-8 shadow-xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-cf-orange mb-2">MultiWorker</h1>
            <p className="text-text-muted">登录以管理你的 Cloudflare 资源</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="password"
              type="password"
              label="密码"
              placeholder="输入管理员密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={error}
              autoFocus
            />

            <Button
              type="submit"
              className="w-full"
              loading={loading}
              disabled={!password}
            >
              登录
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
