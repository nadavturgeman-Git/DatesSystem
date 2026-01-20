'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Distributor {
  id: string
  full_name: string
  email: string
  phone?: string
  pickup_location?: string
  city?: string
}

export default function DistributorSelectionPage() {
  const router = useRouter()
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadDistributors()
  }, [])

  async function loadDistributors() {
    setLoading(true)
    try {
      const response = await fetch('/api/catalog/distributors')
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה בטעינת נקודות איסוף')
      }

      setDistributors(data.distributors || [])
    } catch (err: any) {
      setError(err.message)
      console.error('Error loading distributors:', err)
    } finally {
      setLoading(false)
    }
  }

  function handleDistributorSelect(distributorId: string) {
    router.push(`/order/${distributorId}?dist=selected`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען נקודות איסוף...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800 text-lg font-semibold mb-2">שגיאה</p>
            <p className="text-red-600">{error}</p>
            <button
              onClick={() => loadDistributors()}
              className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              נסה שוב
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">הזמנת תמרים</h1>
            <p className="text-lg text-gray-600">בחר נקודת איסוף</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {distributors.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 max-w-md mx-auto">
              <p className="text-yellow-800 text-lg font-semibold mb-2">אין נקודות איסוף זמינות</p>
              <p className="text-yellow-600">לא נמצאו נקודות איסוף פעילות כרגע.</p>
              <Link
                href="/"
                className="mt-4 inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                חזרה לדף הבית
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 text-center">
              <p className="text-gray-600">
                יש לנו <span className="font-semibold text-emerald-600">{distributors.length}</span> נקודות איסוף ברחבי הארץ
              </p>
            </div>

            {/* Distributors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {distributors.map((distributor) => (
                <button
                  key={distributor.id}
                  onClick={() => handleDistributorSelect(distributor.id)}
                  className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all duration-200 border-2 border-transparent hover:border-emerald-500 text-right group"
                >
                  <div className="p-6">
                    {/* Distributor Name */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">
                          {distributor.full_name}
                        </h3>
                      </div>
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mr-3 group-hover:bg-emerald-200 transition-colors">
                        <svg
                          className="w-5 h-5 text-emerald-600"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="space-y-2">
                      {(distributor.pickup_location || distributor.city) && (
                        <div className="flex items-center text-gray-600">
                          <svg
                            className="w-4 h-4 ml-2 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          <span>{distributor.pickup_location || distributor.city}</span>
                        </div>
                      )}

                      {/* Phone */}
                      {distributor.phone && (
                        <div className="flex items-center text-gray-600">
                          <svg
                            className="w-4 h-4 ml-2 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                            />
                          </svg>
                          <span dir="ltr">{distributor.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Select Button Indicator */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <div className="flex items-center justify-between text-emerald-600 group-hover:text-emerald-700">
                        <span className="font-semibold">בחר נקודת איסוף</span>
                        <svg
                          className="w-5 h-5 transform -scale-x-100 group-hover:-translate-x-1 transition-transform"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="bg-white border-t mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center text-gray-500 text-sm">
            <p>יש לך קישור ישיר לנקודת איסוף? גש ישירות לעמוד ההזמנה.</p>
            <Link href="/" className="text-emerald-600 hover:text-emerald-700 font-medium">
              חזרה לדף הבית
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
