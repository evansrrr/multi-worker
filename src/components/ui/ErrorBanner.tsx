interface ErrorBannerProps {
  error: string
  onDismiss?: () => void
}

/**
 * Unified page-level error banner (replaces the three ad-hoc inline red banners).
 * Use for load/submit errors that should stay visible until dismissed.
 * For transient operation feedback use toasts instead.
 */
export default function ErrorBanner({ error, onDismiss }: ErrorBannerProps) {
  if (!error) return null

  return (
    <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
      <p className="text-red-400">{error}</p>
      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-sm text-red-400 hover:text-red-300 mt-2"
        >
          关闭
        </button>
      )}
    </div>
  )
}
