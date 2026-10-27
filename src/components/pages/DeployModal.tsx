import { useState, useRef } from 'react'
import Button from '../ui/Button'
import ErrorBanner from '../ui/ErrorBanner'

interface DeployModalProps {
  open: boolean
  projectName: string | null
  onClose: () => void
  onDeploy: (projectName: string, file: File) => Promise<void>
}

export default function DeployModal({ open, projectName, onClose, onDeploy }: DeployModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectName || !selectedFile) return

    setError('')
    setLoading(true)

    try {
      await onDeploy(projectName, selectedFile)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '部署失败')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setError('')
      setSelectedFile(null)
      onClose()
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setError('Please select a .zip file')
        return
      }
      setError('')
      setSelectedFile(file)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setError('Please drop a .zip file')
        return
      }
      setError('')
      setSelectedFile(file)
    }
  }

  if (!open || !projectName) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />
      <div className="relative bg-cf-dark-800 rounded-xl p-6 w-full max-w-lg shadow-2xl border border-cf-dark-700 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Deploy Project</h2>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-cf-dark-700 rounded-lg p-4">
            <p className="text-gray-400 text-sm mb-2">Project</p>
            <p className="text-white font-medium">{projectName}</p>
          </div>

          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
              dragOver
                ? 'border-cf-orange bg-cf-orange/10'
                : 'border-cf-dark-600 hover:border-cf-orange/50'
            }`}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileChange}
              className="hidden"
            />
            {selectedFile ? (
              <div>
                <p className="text-white font-medium">{selectedFile.name}</p>
                <p className="text-gray-400 text-sm mt-1">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
                <p className="text-cf-orange text-sm mt-2">Click to change</p>
              </div>
            ) : (
              <div>
                <svg
                  className="w-10 h-10 mx-auto text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
                <p className="text-gray-400 text-sm mt-2">
                  Drag & drop a .zip file, or click to browse
                </p>
              </div>
            )}
          </div>

          <p className="text-gray-400 text-sm">
            Upload a .zip of your static site. The contents will be deployed
            directly to your project and available on the preview URL once
            complete.
          </p>

          {error && <ErrorBanner error={error} onDismiss={() => setError('')} />}

          <div className="flex gap-3 pt-2">
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
              type="submit"
              loading={loading}
              disabled={!selectedFile}
              className="flex-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              Deploy
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
