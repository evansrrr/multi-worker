import { useState, useRef, useCallback } from 'react'
import Button from '../ui/Button'
import ErrorBanner from '../ui/ErrorBanner'
import Modal from '../ui/Modal'
import { ResourceItem } from '../../types'

interface BatchDeployModalProps {
  open: boolean
  targets: ResourceItem[]
  onClose: () => void
  onDeploy: (file: File) => Promise<void>
}

export default function BatchDeployModal({ open, targets, onClose, onDeploy }: BatchDeployModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      setFile(selected)
      setError('')
    }
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped && dropped.name.endsWith('.zip')) {
      setFile(dropped)
      setError('')
    } else {
      setError('Only .zip files are accepted')
    }
  }, [])

  const handleDeploy = async () => {
    if (!file) return
    setError('')
    setLoading(true)

    try {
      await onDeploy(file)
      setFile(null)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setFile(null)
      setError('')
      onClose()
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Modal
      open={open}
      title="Batch Deploy"
      onClose={handleClose}
      closable={!loading}
    >
      {/* Target list */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-text-main mb-2">
          Deploy to {targets.length} resource{targets.length !== 1 ? 's' : ''}
        </label>
        <div className="max-h-32 overflow-y-auto rounded-lg bg-surface border border-border-subtle p-2 space-y-1">
          {targets.map((target) => (
            <div
              key={`${target.accountId}-${target.name}`}
              className="flex items-center gap-2 px-2 py-1 text-sm text-text-main"
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  target.type === 'worker' ? 'bg-orange-500' : 'bg-blue-500'
                }`}
              />
              <span className="truncate">{target.name}</span>
              <span className="text-text-faint text-xs ml-auto flex-shrink-0">
                {target.accountName}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* File upload */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-text-main mb-2">
          Upload ZIP file
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept=".zip"
          onChange={handleFileChange}
          className="hidden"
        />
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragging ? 'border-cf-orange bg-cf-orange/10' : 'border-border-subtle hover:border-border-strong'}
            ${file ? 'bg-surface' : ''}
          `}
        >
          {file ? (
            <div className="flex items-center justify-center gap-3">
              <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div className="text-left">
                <p className="text-sm text-text-main font-medium">{file.name}</p>
                <p className="text-xs text-text-muted">{formatFileSize(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setFile(null)
                }}
                className="ml-2 text-text-muted hover:text-text-main"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              <svg className="w-10 h-10 mx-auto text-text-faint mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-text-main">
                Drag & drop or <span className="text-cf-orange">click to browse</span>
              </p>
              <p className="text-xs text-text-faint mt-1">.zip files only</p>
            </>
          )}
        </div>
      </div>

      {/* Error message */}
      <ErrorBanner error={error} onDismiss={() => setError('')} />

      {/* Action buttons */}
      <div className="flex gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={handleClose}
          disabled={loading}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="button"
          loading={loading}
          disabled={!file}
          onClick={handleDeploy}
          className="flex-1"
        >
          Deploy
        </Button>
      </div>
    </Modal>
  )
}
