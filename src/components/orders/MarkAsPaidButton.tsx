'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface MarkAsPaidButtonProps {
  orderId: string
  paymentStatus: string
  employmentModel?: string
  isDistributor: boolean
}

export default function MarkAsPaidButton({
  orderId,
  paymentStatus,
  employmentModel,
  isDistributor,
}: MarkAsPaidButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  // Only show for distributors with Cash_Paybox model and pending payment
  if (
    !isDistributor ||
    employmentModel !== 'Cash_Paybox' ||
    paymentStatus === 'paid'
  ) {
    return null
  }

  async function handleMarkAsPaid() {
    if (
      !confirm(
        'האם אתה בטוח שהתשלום התקבל? פעולה זו תעדכן את סטטוס ההזמנה לשולם.'
      )
    ) {
      return
    }

    setLoading(true)
    setError('')
    setSuccess(false)

    try {
      const response = await fetch(`/api/orders/${orderId}/mark-paid`, {
        method: 'POST',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה בעדכון התשלום')
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
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            אישור תשלום מזומן
          </h3>
          <p className="text-sm text-gray-600">
            סמן את ההזמנה כשולמה לאחר שקיבלת תשלום מהלקוח
          </p>
        </div>
        <button
          onClick={handleMarkAsPaid}
          disabled={loading || success}
          className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
            loading || success
              ? 'bg-gray-400 cursor-not-allowed text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
        >
          {loading
            ? 'מעדכן...'
            : success
            ? '✓ עודכן בהצלחה'
            : '✓ סמן כשולם'}
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
            התשלום עודכן בהצלחה. הדף יתרענן בעוד רגע...
          </p>
        </div>
      )}
    </div>
  )
}
