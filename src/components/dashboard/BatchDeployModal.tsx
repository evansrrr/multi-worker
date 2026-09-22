import { useState, useRef, useCallback } from 'react'
import Button from '../ui/Button'
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

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-cf-dark-800 rounded-xl p-6 w-full max-w-lg shadow-2xl border border-cf-dark-700 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Batch Deploy</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Target list */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Deploy to {targets.length} resource{targets.length !== 1 ? 's' : ''}
          </label>
          <div className="max-h-32 overflow-y-auto rounded-lg bg-cf-dark-900 border border-cf-dark-700 p-2 space-y-1">
            {targets.map((target) => (
              <div
                key={`${target.accountId}-${target.name}`}
                className="flex items-center gap-2 px-2 py-1 text-sm text-gray-300"
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    target.type === 'worker' ? 'bg-orange-500' : 'bg-blue-500'
                  }`}
                />
                <span className="truncate">{target.name}</span>
                <span className="text-gray-500 text-xs ml-auto flex-shrink-0">
                  {target.accountName}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* File upload */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
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
              ${isDragging ? 'border-cf-orange bg-cf-orange/10' : 'border-cf-dark-600 hover:border-gray-500'}
              ${file ? 'bg-cf-dark-900' : ''}
            `}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <div className="text-left">
                  <p className="text-sm text-white font-medium">{file.name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                  }}
                  className="ml-2 text-gray-400 hover:text-white"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <svg className="w-10 h-10 mx-auto text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-sm text-gray-300">
                  Drag & drop or <span className="text-cf-orange">click to browse</span>
                </p>
                <p className="text-xs text-gray-500 mt-1">.zip files only</p>
              </>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

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
      </div>
    </div>
  )
}
