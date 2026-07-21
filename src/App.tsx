import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { ToastContainer } from './components/ui/Toast'
import { useAuth } from './hooks/useAuth'
import Login from './pages/Auth/Login'
import Setup from './pages/Auth/Setup'
import Dashboard from './pages/Dashboard/Index'
import Accounts from './pages/Accounts/Index'
import Workers from './pages/Workers/Index'
import PagesComponent from './pages/Pages/Index'
import KV from './pages/KV/Index'
import D1 from './pages/D1/Index'
import Settings from './pages/Settings/Index'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, needsSetup, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cf-dark-900 flex items-center justify-center">
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
      <div className="min-h-screen bg-cf-dark-900 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-cf-orange border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!needsSetup && isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
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
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts"
        element={
          <ProtectedRoute>
            <Accounts />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts/:accountId/workers"
        element={
          <ProtectedRoute>
            <Workers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts/:accountId/pages"
        element={
          <ProtectedRoute>
            <PagesComponent />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts/:accountId/kv"
        element={
          <ProtectedRoute>
            <KV />
          </ProtectedRoute>
        }
      />
      <Route
        path="/accounts/:accountId/d1"
        element={
          <ProtectedRoute>
            <D1 />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
          <ToastContainer />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
