import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Auth/Login'
import Setup from './pages/Auth/Setup'
import Dashboard from './pages/Dashboard/Index'
import Accounts from './pages/Accounts/Index'
import Workers from './pages/Workers/Index'
import PagesComponent from './pages/Pages/Index'
import KV from './pages/KV/Index'
import D1 from './pages/D1/Index'
import Settings from './pages/Settings/Index'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/setup" element={<Setup />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/accounts" element={<Accounts />} />
        <Route path="/accounts/:accountId/workers" element={<Workers />} />
        <Route path="/accounts/:accountId/pages" element={<PagesComponent />} />
        <Route path="/accounts/:accountId/kv" element={<KV />} />
        <Route path="/accounts/:accountId/d1" element={<D1 />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
