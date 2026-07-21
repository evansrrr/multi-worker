import { useParams } from 'react-router-dom'
import Layout from '../../components/layout/Layout'

export default function Workers() {
  const { accountId } = useParams()

  return (
    <Layout>
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-cf-orange mb-4">Workers</h1>
          <p className="text-cf-dark-600">Workers for account {accountId}</p>
        </div>
      </div>
    </Layout>
  )
}
