import { useParams } from 'react-router-dom'
import Layout from '../../components/layout/Layout'

export default function PagesComponent() {
  const { accountId } = useParams()

  return (
    <Layout>
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-cf-orange mb-4">Pages</h1>
          <p className="text-cf-dark-600">Pages for account {accountId}</p>
        </div>
      </div>
    </Layout>
  )
}
