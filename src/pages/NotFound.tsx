import { Link, useNavigate } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import Button from '../components/ui/Button'

/**
 * 404 页（阶段3 / H9）：取代通配符静默跳转 /dashboard，避免错误链接被掩盖。
 */
export default function NotFound() {
  const navigate = useNavigate()

  return (
    <Layout crumbs={[{ label: '404' }]}>
      <div className="max-w-lg mx-auto text-center py-20">
        <p className="text-6xl font-bold text-cf-orange mb-4">404</p>
        <h1 className="text-2xl font-semibold text-text-main mb-2">页面不存在</h1>
        <p className="text-text-muted mb-8">
          你访问的地址没有对应页面，可能链接已失效或输入有误。
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => navigate('/dashboard')}>返回 Dashboard</Button>
          <Link
            to="/accounts"
            className="px-4 py-2 rounded-lg font-medium bg-surface-3 hover:bg-surface-inset text-text-main border border-border-strong transition-colors"
          >
            查看账户
          </Link>
        </div>
      </div>
    </Layout>
  )
}
