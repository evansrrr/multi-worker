import { useParams } from 'react-router-dom'

export default function KV() {
  const { accountId } = useParams()

  return (
    <div className="min-h-screen bg-cf-dark-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-cf-orange mb-4">KV</h1>
        <p className="text-cf-dark-600">KV namespaces for account {accountId}</p>
      </div>
    </div>
  )
}
