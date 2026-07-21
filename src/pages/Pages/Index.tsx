import { useParams } from 'react-router-dom'

export default function PagesComponent() {
  const { accountId } = useParams()

  return (
    <div className="min-h-screen bg-cf-dark-900 text-white flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-cf-orange mb-4">Pages</h1>
        <p className="text-cf-dark-600">Pages for account {accountId}</p>
      </div>
    </div>
  )
}
