import { useState, useEffect } from 'react'
import Button from '../ui/Button'
import Input from '../ui/Input'

interface Binding {
  name: string
  type: string
  [key: string]: unknown
}

interface KvNamespace {
  id: string
  title: string
  description?: string
}

interface D1Database {
  uuid: string
  name: string
}

interface BindingsEditorProps {
  accountId: string
  workerName: string
  onClose: () => void
}

const BINDING_TYPES = [
  { value: 'kv_namespace', label: 'KV Namespace' },
  { value: 'd1', label: 'D1 Database' },
  { value: 'env_var', label: 'Environment Variable' },
  { value: 'service', label: 'Service Binding' },
  { value: 'ai', label: 'AI' },
  { value: 'analytics_engine', label: 'Analytics Engine' },
  { value: 'browser', label: 'Browser' },
  { value: 'durable_object_namespace', label: 'Durable Object' },
  { value: 'hyperdrive', label: 'Hyperdrive' },
  { value: 'images', label: 'Images' },
  { value: 'json', label: 'JSON' },
  { value: 'plain_text', label: 'Plain Text' },
  { value: 'r2_bucket', label: 'R2 Bucket' },
  { value: 'vectorize', label: 'Vectorize' },
  { value: 'version_metadata', label: 'Version Metadata' },
  { value: 'secrets_store', label: 'Secrets Store' },
]

function BindingTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    kv_namespace: 'bg-cyan-500/10 text-cyan-400',
    d1: 'bg-purple-500/10 text-purple-400',
    env_var: 'bg-green-500/10 text-green-400',
    service: 'bg-blue-500/10 text-blue-400',
    ai: 'bg-pink-500/10 text-pink-400',
    analytics_engine: 'bg-yellow-500/10 text-yellow-400',
    browser: 'bg-orange-500/10 text-orange-400',
    durable_object_namespace: 'bg-indigo-500/10 text-indigo-400',
    hyperdrive: 'bg-red-500/10 text-red-400',
    images: 'bg-teal-500/10 text-teal-400',
    json: 'bg-gray-500/10 text-gray-400',
    plain_text: 'bg-gray-500/10 text-gray-400',
    r2_bucket: 'bg-amber-500/10 text-amber-400',
    vectorize: 'bg-violet-500/10 text-violet-400',
    version_metadata: 'bg-slate-500/10 text-slate-400',
    secrets_store: 'bg-rose-500/10 text-rose-400',
  }

  return (
    <span className={`px-2 py-0.5 text-xs rounded font-medium ${colors[type] || 'bg-gray-500/10 text-gray-400'}`}>
      {type.replace(/_/g, ' ')}
    </span>
  )
}

export default function BindingsEditor({ accountId, workerName, onClose }: BindingsEditorProps) {
  const [bindings, setBindings] = useState<Binding[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [kvNamespaces, setKvNamespaces] = useState<KvNamespace[]>([])
  const [d1Databases, setD1Databases] = useState<D1Database[]>([])

  useEffect(() => {
    fetchBindings()
    fetchAvailableResources()
  }, [accountId, workerName])

  const fetchBindings = async () => {
    try {
      const response = await fetch(`/api/accounts/${accountId}/workers/${workerName}/bindings`)
      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setBindings(data.bindings || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bindings')
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableResources = async () => {
    try {
      const [kvRes, d1Res] = await Promise.all([
        fetch(`/api/accounts/${accountId}/kv`),
        fetch(`/api/accounts/${accountId}/d1`),
      ])
      const kvData = await kvRes.json()
      const d1Data = await d1Res.json()
      setKvNamespaces(kvData.namespaces || [])
      setD1Databases(d1Data.databases || [])
    } catch {
      // Resources will be empty, manual entry still available
    }
  }

  const handleSaveBindings = async () => {
    setSaving(true)
    setError('')

    try {
      const response = await fetch(`/api/accounts/${accountId}/workers/${workerName}/bindings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bindings }),
      })

      const data = await response.json()

      if (data.error) {
        throw new Error(data.error)
      }

      setBindings(data.bindings || [])
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bindings')
    } finally {
      setSaving(false)
    }
  }

  const handleAddBinding = (binding: Binding) => {
    if (editingIndex !== null) {
      const updated = [...bindings]
      updated[editingIndex] = binding
      setBindings(updated)
      setEditingIndex(null)
    } else {
      setBindings([...bindings, binding])
    }
    setShowAddModal(false)
  }

  const handleRemoveBinding = (index: number) => {
    setBindings(bindings.filter((_, i) => i !== index))
  }

  const handleEditBinding = (index: number) => {
    setEditingIndex(index)
    setShowAddModal(true)
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div className="relative bg-cf-dark-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl border border-cf-dark-700 mx-4">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-cf-orange border-t-transparent rounded-full" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !saving && onClose()}
      />
      <div className="relative bg-cf-dark-800 rounded-xl p-6 w-full max-w-2xl shadow-2xl border border-cf-dark-700 mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Worker Bindings</h2>
            <p className="text-sm text-gray-400 mt-1">
              Configure bindings for {workerName}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
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

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto mb-4">
          {bindings.length === 0 ? (
            <div className="text-center py-8">
              <svg
                className="w-12 h-12 text-gray-500 mx-auto mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-3.37a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.374"
                />
              </svg>
              <p className="text-gray-400">No bindings configured</p>
              <p className="text-sm text-gray-500 mt-1">Click "Add Binding" to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bindings.map((binding, index) => (
                <div
                  key={`${binding.name}-${index}`}
                  className="flex items-center justify-between p-3 bg-cf-dark-700/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-cf-dark-600 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-3.37a4.5 4.5 0 00-1.242-7.244l-4.5-4.5a4.5 4.5 0 00-6.364 6.364L4.34 8.374"
                        />
                      </svg>
                    </div>
                    <div>
                      <span className="text-white font-medium">{binding.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <BindingTypeBadge type={binding.type} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEditBinding(index)}
                      disabled={saving}
                      className="p-1.5 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
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
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleRemoveBinding(index)}
                      disabled={saving}
                      className="p-1.5 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t border-cf-dark-700">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setEditingIndex(null)
              setShowAddModal(true)
            }}
            disabled={saving}
          >
            Add Binding
          </Button>
          <div className="flex-1" />
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveBindings}
            loading={saving}
          >
            Save Bindings
          </Button>
        </div>
      </div>

      {showAddModal && (
        <AddBindingModal
          binding={editingIndex !== null ? bindings[editingIndex] : undefined}
          kvNamespaces={kvNamespaces}
          d1Databases={d1Databases}
          onAdd={handleAddBinding}
          onClose={() => {
            setShowAddModal(false)
            setEditingIndex(null)
          }}
        />
      )}
    </div>
  )
}

interface AddBindingModalProps {
  binding?: Binding
  kvNamespaces: KvNamespace[]
  d1Databases: D1Database[]
  onAdd: (binding: Binding) => void
  onClose: () => void
}

function AddBindingModal({ binding, kvNamespaces, d1Databases, onAdd, onClose }: AddBindingModalProps) {
  const [name, setName] = useState(binding?.name || '')
  const [type, setType] = useState(binding?.type || 'kv_namespace')
  const [namespaceId, setNamespaceId] = useState((binding?.namespace_id as string) || '')
  const [databaseId, setDatabaseId] = useState((binding?.database_id as string) || '')
  const [value, setValue] = useState((binding?.text as string) || (binding?.json as string) || '')
  const [serviceName, setServiceName] = useState((binding?.service as string) || '')
  const [className, setClassName] = useState((binding?.class_name as string) || '')
  const [dataset, setDataset] = useState((binding?.dataset as string) || '')
  const [bucketName, setBucketName] = useState((binding?.bucket_name as string) || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newBinding: Binding = { name, type }

    switch (type) {
      case 'kv_namespace':
        newBinding.namespace_id = namespaceId
        break
      case 'd1':
        newBinding.database_id = databaseId
        break
      case 'env_var':
      case 'plain_text':
        newBinding.text = value
        break
      case 'json':
        newBinding.json = value
        break
      case 'service':
        newBinding.service = serviceName
        break
      case 'durable_object_namespace':
        newBinding.class_name = className
        break
      case 'analytics_engine':
        newBinding.dataset = dataset
        break
      case 'r2_bucket':
        newBinding.bucket_name = bucketName
        break
    }

    onAdd(newBinding)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-cf-dark-800 rounded-xl p-6 w-full max-w-md shadow-2xl border border-cf-dark-700 mx-4">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">
            {binding ? 'Edit Binding' : 'Add Binding'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
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
          <Input
            id="binding-name"
            label="Binding Name"
            placeholder="MY_KV"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            required
          />

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-300">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-3 py-2 bg-cf-dark-800 border border-cf-dark-600 rounded-lg 
                text-white 
                focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent"
            >
              {BINDING_TYPES.map((bt) => (
                <option key={bt.value} value={bt.value}>
                  {bt.label}
                </option>
              ))}
            </select>
          </div>

          {type === 'kv_namespace' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">
                KV Namespace
              </label>
              {kvNamespaces.length > 0 ? (
                <select
                  value={namespaceId}
                  onChange={(e) => setNamespaceId(e.target.value)}
                  className="w-full px-3 py-2 bg-cf-dark-800 border border-cf-dark-600 rounded-lg 
                    text-white 
                    focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent"
                  required
                >
                  <option value="">Select a KV namespace...</option>
                  {kvNamespaces.map((ns) => (
                    <option key={ns.id} value={ns.id}>
                      {ns.title} ({ns.id.slice(0, 8)}...)
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="namespace-id"
                  placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={namespaceId}
                  onChange={(e) => setNamespaceId(e.target.value)}
                  required
                />
              )}
              <p className="text-xs text-gray-500 mt-1">
                {kvNamespaces.length > 0 
                  ? 'Select from available namespaces or enter manually'
                  : 'Enter the KV namespace ID manually'}
              </p>
            </div>
          )}

          {type === 'd1' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">
                D1 Database
              </label>
              {d1Databases.length > 0 ? (
                <select
                  value={databaseId}
                  onChange={(e) => setDatabaseId(e.target.value)}
                  className="w-full px-3 py-2 bg-cf-dark-800 border border-cf-dark-600 rounded-lg 
                    text-white 
                    focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent"
                  required
                >
                  <option value="">Select a D1 database...</option>
                  {d1Databases.map((db) => (
                    <option key={db.uuid} value={db.uuid}>
                      {db.name} ({db.uuid.slice(0, 8)}...)
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id="database-id"
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={databaseId}
                  onChange={(e) => setDatabaseId(e.target.value)}
                  required
                />
              )}
              <p className="text-xs text-gray-500 mt-1">
                {d1Databases.length > 0 
                  ? 'Select from available databases or enter manually'
                  : 'Enter the D1 database ID manually'}
              </p>
            </div>
          )}

          {(type === 'env_var' || type === 'plain_text') && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">
                Value
              </label>
              <textarea
                className="w-full px-3 py-2 bg-cf-dark-800 border border-cf-dark-600 rounded-lg 
                  text-white placeholder-gray-500 font-mono text-sm
                  focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent
                  min-h-[80px] resize-y"
                placeholder="Enter value..."
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </div>
          )}

          {type === 'json' && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-300">
                JSON Value
              </label>
              <textarea
                className="w-full px-3 py-2 bg-cf-dark-800 border border-cf-dark-600 rounded-lg 
                  text-white placeholder-gray-500 font-mono text-sm
                  focus:outline-none focus:ring-2 focus:ring-cf-orange focus:border-transparent
                  min-h-[80px] resize-y"
                placeholder='{"key": "value"}'
                value={value}
                onChange={(e) => setValue(e.target.value)}
                required
              />
            </div>
          )}

          {type === 'service' && (
            <Input
              id="service-name"
              label="Service Name"
              placeholder="my-service"
              value={serviceName}
              onChange={(e) => setServiceName(e.target.value)}
              required
            />
          )}

          {type === 'durable_object_namespace' && (
            <Input
              id="class-name"
              label="Class Name"
              placeholder="MyDurableObject"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              required
            />
          )}

          {type === 'analytics_engine' && (
            <Input
              id="dataset"
              label="Dataset"
              placeholder="my-dataset"
              value={dataset}
              onChange={(e) => setDataset(e.target.value)}
              required
            />
          )}

          {type === 'r2_bucket' && (
            <Input
              id="bucket-name"
              label="Bucket Name"
              placeholder="my-bucket"
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
              required
            />
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name}
              className="flex-1"
            >
              {binding ? 'Update' : 'Add'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
