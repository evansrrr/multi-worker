import { useEffect, createContext, useContext, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams, useLocation } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ToastContainer } from './components/ui/Toast'
import { ThemeProvider } from './hooks/useTheme'
import { useAuth } from './hooks/useAuth'
import { useToast } from './hooks/useToast'
import { subscribeToast } from './lib/api'
import Layout from './components/layout/Layout'
import Header from './components/layout/Header'
import Login from './pages/Auth/Login'
import Setup from './pages/Auth/Setup'
import Dashboard from './pages/Dashboard/Index'
import Accounts from './pages/Accounts/Index'
import Workers from './pages/Workers/Index'
import WorkerDetail from './pages/Workers/Detail'
import PagesComponent from './pages/Pages/Index'
import PagesDetail from './pages/Pages/Detail'
import KV from './pages/KV/Index'
import D1 from './pages/D1/Index'
import Settings from './pages/Settings/Index'
import NotFound from './pages/NotFound'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, needsSetup, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-cf-orange border-t-transparent rounded-full" />
      </div>
    )
  }

  if (needsSetup) {
    return <Navigate to="/setup" replace />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, needsSetup, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-cf-orange border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!needsSetup && isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

/* ---------- 账户级布局（阶段3 / H9）：账户上下文 + 二级 Tab 出口 ---------- */

const AccountTabsContext = createContext<{
  accountName: string
  setAccountName: (name: string) => void
}>({ accountName: '', setAccountName: () => {} })

/** 子页面用它上报当前账户名，供面包屑显示 */
export function useAccountNameReporter() {
  return useContext(AccountTabsContext)
}

function AccountLayout() {
  const { accountId } = useParams<{ accountId: string }>()
  const location = useLocation()
  const [accountName, setAccountName] = useState('')

  // 切换账户时重置已上报的账户名
  useEffect(() => {
    setAccountName('')
  }, [accountId])

  const segment = location.pathname.split('/')[3] || ''
  const tabLabel = segment === 'pages' ? 'Pages' : segment === 'kv' ? 'KV' : segment === 'd1' ? 'D1' : 'Workers'

  return (
    <AccountTabsContext.Provider value={{ accountName, setAccountName }}>
      <Layout
        crumbs={[
          { label: '账户', to: '/accounts' },
          { label: accountName || accountId || '', to: `/accounts/${accountId}/workers` },
          { label: tabLabel },
        ]}
      >
        <div className="flex items-center justify-end mb-4">
          <Header />
        </div>
        <Outlet />
      </Layout>
    </AccountTabsContext.Provider>
  )
}

function PlainLayout({ children }: { children: React.ReactNode }) {
  return (
    <Layout>
      <div className="flex items-center justify-end mb-4">
        <Header />
      </div>
      {children}
    </Layout>
  )
}

/** 详情页面包屑：账户 / Workers|Pages / 名称 */
function WorkerDetailWithCrumbs() {
  const { accountId, workerName } = useParams<{ accountId: string; workerName: string }>()
  return (
    <Layout
      crumbs={[
        { label: '账户', to: '/accounts' },
        { label: 'Workers', to: `/accounts/${accountId}/workers` },
        { label: workerName || '' },
      ]}
    >
      <div className="flex items-center justify-end mb-4">
        <Header />
      </div>
      <WorkerDetail />
    </Layout>
  )
}

function PagesDetailWithCrumbs() {
  const { accountId, projectName } = useParams<{ accountId: string; projectName: string }>()
  return (
    <Layout
      crumbs={[
        { label: '账户', to: '/accounts' },
        { label: 'Pages', to: `/accounts/${accountId}/pages` },
        { label: projectName || '' },
      ]}
    >
      <div className="flex items-center justify-end mb-4">
        <Header />
      </div>
      <PagesDetail />
    </Layout>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/setup"
        element={
          <PublicRoute>
            <Setup />
          </PublicRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <PlainLayout>
              <Dashboard />
            </PlainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts"
        element={
          <ProtectedRoute>
            <PlainLayout>
              <Accounts />
            </PlainLayout>
          </ProtectedRoute>
        }
      />
      {/* 账户级嵌套路由：二级 Tab 由 Sidebar 提供 */}
      <Route
        path="/accounts/:accountId"
        element={
          <ProtectedRoute>
            <AccountLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="workers" replace />} />
        <Route path="workers" element={<Workers />} />
        <Route path="pages" element={<PagesComponent />} />
        {/* 选中态入 URL：KV 命名空间 / D1 数据库可刷新、分享、后退 */}
        <Route path="kv" element={<KV />} />
        <Route path="kv/:namespaceId" element={<KV />} />
        <Route path="d1" element={<D1 />} />
        <Route path="d1/:databaseId" element={<D1 />} />
      </Route>
      <Route
        path="/accounts/:accountId/workers/:workerName"
        element={
          <ProtectedRoute>
            <WorkerDetailWithCrumbs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts/:accountId/pages/:projectName"
        element={
          <ProtectedRoute>
            <PagesDetailWithCrumbs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <PlainLayout>
              <Settings />
            </PlainLayout>
          </ProtectedRoute>
        }
      />
      {/* 404：不再静默跳转 /dashboard */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

/** Bridges the module-level toast bus (used by the api client) into React. */
function ToastBridge() {
  const { addToast } = useToast()
  useEffect(() => subscribeToast((message, type) => addToast(message, type)), [addToast])
  return null
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
            <ToastContainer />
            <ToastBridge />
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
