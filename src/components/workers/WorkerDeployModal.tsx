import { useState, useRef } from 'react'
import Button from '../ui/Button'

interface WorkerDeployModalProps {
  open: boolean
  workerName: string | null
  onClose: () => void
  onDeploy: (workerName: string, files: File[]) => Promise<void>
}

type DeployStep = 'upload' | 'configure' | 'deploy' | 'complete'

export default function WorkerDeployModal({ open, workerName, onClose, onDeploy }: WorkerDeployModalProps) {
  const [step, setStep] = useState<DeployStep>('upload')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mainModule, setMainModule] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleClose = () => {
    if (!loading) {
      setStep('upload')
      setFiles([])
      setMainModule('')
      setError('')
      onClose()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || [])
    setFiles((prev) => [...prev, ...selectedFiles])
    // Auto-detect main module
    if (!mainModule) {
      const mainFile = selectedFiles.find(
        (f) => f.name === 'index.js' || f.name === 'index.ts' || f.name === 'worker.js' || f.name === 'worker.ts'
      )
      if (mainFile) {
        setMainModule(mainFile.name)
      }
    }
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
    if (mainModule === files[index]?.name) {
      setMainModule('')
    }
  }

  const handleDeploy = async () => {
    if (!workerName || files.length === 0) return

    setError('')
    setLoading(true)

    try {
      await onDeploy(workerName, files)
      setStep('complete')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deploy worker')
    } finally {
      setLoading(false)
    }
  }

  if (!open || !workerName) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-cf-dark-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl border border-cf-dark-700 mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Deploy Worker</h2>
            <p className="text-sm text-gray-400 mt-1">
              {step === 'upload' && 'Upload your Worker script files'}
              {step === 'configure' && 'Configure deployment settings'}
              {step === 'deploy' && 'Deploying your Worker...'}
              {step === 'complete' && 'Deployment successful!'}
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {(['upload', 'configure', 'deploy', 'complete'] as DeployStep[]).map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${step === s 
                    ? 'bg-cf-orange text-white' 
                    : ['upload', 'configure', 'deploy', 'complete'].indexOf(step) > i
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-cf-dark-700 text-gray-500'
                  }`}
              >
                {['upload', 'configure', 'deploy', 'complete'].indexOf(step) > i ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && (
                <div className={`w-12 h-0.5 mx-1 ${
                  ['upload', 'configure', 'deploy', 'complete'].indexOf(step) > i
                    ? 'bg-green-500/50'
                    : 'bg-cf-dark-700'
                }`} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="bg-cf-dark-700 rounded-lg p-4">
                <p className="text-white font-medium mb-2">Worker: {workerName}</p>
                <p className="text-sm text-gray-400">
                  Upload your Worker script files. The main module will be executed when the Worker receives a request.
                </p>
              </div>

              <div
                className="border-2 border-dashed border-cf-dark-600 rounded-lg p-8 text-center hover:border-cf-orange/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg className="w-12 h-12 text-gray-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                <p className="text-gray-400 mb-2">Click to upload or drag and drop</p>
                <p className="text-sm text-gray-500">JS, TS, or Wasm files</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".js,.ts,.mjs,.cjs,.wasm"
                className="hidden"
                onChange={handleFileSelect}
              />

              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-300">Uploaded files:</p>
                  {files.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center justify-between p-3 bg-cf-dark-700/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <svg className="w-5 h-5 text-cf-orange" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="text-white font-mono text-sm">{file.name}</span>
                        <span className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</span>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        disabled={loading}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Configure */}
          {step === 'configure' && (
            <div className="space-y-4">
              <div className="bg-cf-dark-700 rounded-lg p-4">
                <p className="text-white font-medium mb-2">Deployment Configuration</p>
                <p className="text-sm text-gray-400">
                  Configure which file is the main entry point for your Worker.
                </p>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-300">
                  Main Module
                </label>
                <select
                  value={mainModule}
                  onChange={(e) => setMainModule(e.target.value)}
                  className="w-full px-3 py-2 bg-cf-dark-800 border border-cf-dark-600 rounded-lg 
                    text-white 
                    focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent"
                >
                  <option value="">Select main module...</option>
                  {files.map((file) => (
                    <option key={file.name} value={file.name}>
                      {file.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  The main module handles incoming requests. For module syntax Workers, this exports a default fetch handler.
                </p>
              </div>

              <div className="bg-cf-dark-700/50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-300 mb-2">Files to deploy:</p>
                <div className="space-y-1">
                  {files.map((file) => (
                    <div key={file.name} className="flex items-center gap-2 text-sm">
                      <span className={`w-2 h-2 rounded-full ${file.name === mainModule ? 'bg-cf-orange' : 'bg-gray-500'}`} />
                      <span className="text-white font-mono">{file.name}</span>
                      {file.name === mainModule && (
                        <span className="text-xs text-cf-orange">(main)</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Deploying */}
          {step === 'deploy' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin h-12 w-12 border-4 border-cf-orange border-t-transparent rounded-full mb-4" />
              <p className="text-white font-medium">Deploying {workerName}...</p>
              <p className="text-sm text-gray-400 mt-1">This may take a moment</p>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 'complete' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-white font-medium text-lg">Deployment Successful!</p>
              <p className="text-sm text-gray-400 mt-1">
                Your Worker has been deployed and is now active.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 pt-4 border-t border-cf-dark-700 mt-4">
          {step === 'upload' && (
            <>
              <Button variant="secondary" onClick={handleClose} disabled={loading} className="flex-1">
                Cancel
              </Button>
              <Button 
                onClick={() => setStep('configure')} 
                disabled={files.length === 0}
                className="flex-1"
              >
                Next: Configure
              </Button>
            </>
          )}
          {step === 'configure' && (
            <>
              <Button variant="secondary" onClick={() => setStep('upload')} disabled={loading} className="flex-1">
                Back
              </Button>
              <Button 
                onClick={() => {
                  setStep('deploy')
                  handleDeploy()
                }} 
                disabled={!mainModule || loading}
                className="flex-1"
              >
                Deploy Worker
              </Button>
            </>
          )}
          {step === 'complete' && (
            <Button onClick={handleClose} className="flex-1">
              Done
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
