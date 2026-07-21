import { useContext } from 'react'
import { ToastContext, Toast as ToastType } from '../../contexts/ToastContext'

function ToastItem({ toast }: { toast: ToastType }) {
  const { removeToast } = useContext(ToastContext)!

  const styles = {
    success: 'bg-green-500/90 text-white',
    error: 'bg-red-500/90 text-white',
    info: 'bg-blue-500/90 text-white',
  }

  return (
    <div
      className={`flex items-center justify-between px-4 py-3 rounded-lg shadow-lg ${styles[toast.type]}`}
    >
      <span>{toast.message}</span>
      <button
        onClick={() => removeToast(toast.id)}
        className="ml-4 text-white/80 hover:text-white"
      >
        &times;
      </button>
    </div>
  )
}

export function ToastContainer() {
  const { toasts } = useContext(ToastContext)!

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  )
}