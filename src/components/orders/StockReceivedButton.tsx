'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface StockReceivedButtonProps {
  orderId: string
  deliveryStatus?: string
  isDistributor: boolean
}

export default function StockReceivedButton({
  orderId,
  deliveryStatus,
  isDistributor,
}: StockReceivedButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  // Only show for distributors and if not already received
  if (!isDistributor || deliveryStatus === 'Delivered_to_Distributor') {
    return null
  }

  async function handleMarkReceived() {
    if (!confirm('האם אתה בטוח שהמלאי התקבל ואתה מוכן לשלוח התראות ללקוחות?')) {
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch(`/api/orders/${orderId}/mark-received`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה בעדכון הזמנה')
      }

      setSuccess(true)
      // Refresh page after 2 seconds
      setTimeout(() => {
        router.refresh()
      }, 2000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">סימון מלאי כנתקבל</h3>
          <p className="text-sm text-gray-600">
            לחץ כאן כאשר המלאי התקבל ואתה מוכן לשלוח התראות ללקוחות
          </p>
        </div>
        <button
          onClick={handleMarkReceived}
          disabled={loading || success}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            loading || success
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {loading ? 'שולח...' : success ? '✓ נשלח' : 'סימון כנתקבל'}
        </button>
      </div>
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">
            ההזמנה סומנה כנתקבלה והתראות נשלחו ללקוחות
          </p>
        </div>
      )}
    </div>
  )
}
