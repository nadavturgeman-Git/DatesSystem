'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

// Return reason type matching database enum
type ReturnReason = 'damaged' | 'missed_collection' | 'quality_issue' | 'other'

// Return reason options with Hebrew labels
const RETURN_REASONS: { value: ReturnReason; label: string }[] = [
  { value: 'damaged', label: 'מוצר פגום' },
  { value: 'missed_collection', label: 'פריטים חסרים' },
  { value: 'quality_issue', label: 'בעיית איכות' },
  { value: 'other', label: 'אחר' },
]

// Photo file with preview
interface PhotoFile {
  id: string
  file: File
  preview: string
  uploading?: boolean
  error?: string
  uploaded?: boolean
  url?: string
}

// Order data interface
interface OrderData {
  id: string
  order_number: string
  status: string
  payment_status: string
  delivery_status: string | null
  total_weight_kg: number
  total_amount: number
  created_at: string
  distributor?: {
    full_name: string
    phone?: string
  } | null
  items?: Array<{
    id: string
    quantity_kg: number
    unit_price: number
    subtotal: number
    product?: {
      name: string
      variety?: string
    }
  }>
}

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024
// Maximum number of photos
const MAX_PHOTOS = 5
// Allowed file types
const ALLOWED_TYPES = ['image/jpeg', 'image/png']

export default function ReportFaultPage() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Form state
  const [orderNumber, setOrderNumber] = useState('')
  const [order, setOrder] = useState<OrderData | null>(null)
  const [photos, setPhotos] = useState<PhotoFile[]>([])
  const [description, setDescription] = useState('')
  const [reason, setReason] = useState<ReturnReason>('damaged')

  // UI state
  const [loading, setLoading] = useState(false)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Check for orderId in URL params on mount
  useEffect(() => {
    const orderId = searchParams.get('orderId')
    if (orderId) {
      loadOrderById(orderId)
    }
  }, [searchParams])

  // Cleanup photo previews on unmount
  useEffect(() => {
    return () => {
      photos.forEach(photo => {
        URL.revokeObjectURL(photo.preview)
      })
    }
  }, [photos])

  // Load order by ID (from URL param)
  async function loadOrderById(orderId: string) {
    setLookupLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/orders/${orderId}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'הזמנה לא נמצאה')
      }

      const orderData: OrderData = {
        ...data.order,
        items: data.orderItems || [],
      }

      // Validate delivery status
      if (orderData.delivery_status !== 'Picked_up_by_Customer') {
        throw new Error('ניתן לדווח על תקלה רק עבור הזמנות שנאספו')
      }

      setOrder(orderData)
      setOrderNumber(orderData.order_number)
    } catch (err: any) {
      setError(err.message)
      setOrder(null)
    } finally {
      setLookupLoading(false)
    }
  }

  // Lookup order by order number
  async function lookupOrder() {
    if (!orderNumber.trim()) {
      setError('יש להזין מספר הזמנה')
      return
    }

    setLookupLoading(true)
    setError('')

    try {
      // First try to find the order by order_number using API
      const response = await fetch(`/api/orders/lookup?orderNumber=${encodeURIComponent(orderNumber.trim())}`)

      if (!response.ok) {
        // If lookup endpoint doesn't exist, try direct ID lookup
        const directResponse = await fetch(`/api/orders/${orderNumber.trim()}`)
        const directData = await directResponse.json()

        if (!directResponse.ok) {
          throw new Error(directData.error || 'הזמנה לא נמצאה')
        }

        const orderData: OrderData = {
          ...directData.order,
          items: directData.orderItems || [],
        }

        // Validate delivery status
        if (orderData.delivery_status !== 'Picked_up_by_Customer') {
          throw new Error('ניתן לדווח על תקלה רק עבור הזמנות שנאספו')
        }

        setOrder(orderData)
        return
      }

      const data = await response.json()

      if (!data.order) {
        throw new Error('הזמנה לא נמצאה')
      }

      const orderData: OrderData = {
        ...data.order,
        items: data.orderItems || [],
      }

      // Validate delivery status
      if (orderData.delivery_status !== 'Picked_up_by_Customer') {
        throw new Error('ניתן לדווח על תקלה רק עבור הזמנות שנאספו')
      }

      setOrder(orderData)
    } catch (err: any) {
      setError(err.message)
      setOrder(null)
    } finally {
      setLookupLoading(false)
    }
  }

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    const remainingSlots = MAX_PHOTOS - photos.length
    if (remainingSlots <= 0) {
      setError(`ניתן להעלות עד ${MAX_PHOTOS} תמונות בלבד`)
      return
    }

    const newPhotos: PhotoFile[] = []
    const errors: string[] = []

    Array.from(files).slice(0, remainingSlots).forEach((file, index) => {
      // Validate file type
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(`${file.name}: סוג קובץ לא נתמך (רק JPEG או PNG)`)
        return
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name}: קובץ גדול מדי (מקסימום 5MB)`)
        return
      }

      newPhotos.push({
        id: `${Date.now()}_${index}`,
        file,
        preview: URL.createObjectURL(file),
      })
    })

    if (errors.length > 0) {
      setError(errors.join('\n'))
    }

    if (newPhotos.length > 0) {
      setPhotos(prev => [...prev, ...newPhotos])
    }

    // Reset input
    event.target.value = ''
  }, [photos.length])

  // Remove photo
  const removePhoto = useCallback((photoId: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === photoId)
      if (photo) {
        URL.revokeObjectURL(photo.preview)
      }
      return prev.filter(p => p.id !== photoId)
    })
  }, [])

  // Upload photos to Supabase Storage
  async function uploadPhotos(): Promise<string[]> {
    const uploadedUrls: string[] = []
    const timestamp = Date.now()

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]

      // Update photo state to show uploading
      setPhotos(prev => prev.map(p =>
        p.id === photo.id ? { ...p, uploading: true, error: undefined } : p
      ))

      try {
        // Generate filename
        const ext = photo.file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const filename = `${order!.id}_${timestamp}_${i}.${ext}`

        // Upload to Supabase Storage
        const { data, error: uploadError } = await supabase.storage
          .from('fault-reports')
          .upload(filename, photo.file, {
            cacheControl: '3600',
            upsert: false,
          })

        if (uploadError) {
          throw uploadError
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('fault-reports')
          .getPublicUrl(filename)

        uploadedUrls.push(publicUrl)

        // Update photo state to show success
        setPhotos(prev => prev.map(p =>
          p.id === photo.id ? { ...p, uploading: false, uploaded: true, url: publicUrl } : p
        ))
      } catch (err: any) {
        // Update photo state to show error
        setPhotos(prev => prev.map(p =>
          p.id === photo.id ? { ...p, uploading: false, error: err.message } : p
        ))
        throw new Error(`שגיאה בהעלאת תמונה: ${err.message}`)
      }
    }

    return uploadedUrls
  }

  // Submit fault report
  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    // Validate form
    if (!order) {
      setSubmitError('יש לחפש הזמנה תחילה')
      return
    }

    if (description.trim().length < 10) {
      setSubmitError('תיאור הבעיה חייב להכיל לפחות 10 תווים')
      return
    }

    setSubmitting(true)
    setSubmitError('')

    try {
      // Upload photos first
      const imageUrls = photos.length > 0 ? await uploadPhotos() : []

      // Submit fault report to API
      const response = await fetch('/api/fault-reports/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: order.id,
          reason,
          description: description.trim(),
          imageUrls,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה ביצירת דיווח התקלה')
      }

      // Success
      setSuccess(true)
    } catch (err: any) {
      setSubmitError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Reset form
  function resetForm() {
    setOrder(null)
    setOrderNumber('')
    setPhotos([])
    setDescription('')
    setReason('damaged')
    setError('')
    setSubmitError('')
    setSuccess(false)
  }

  // Success view
  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-emerald-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">הדיווח נשלח בהצלחה!</h1>
          <p className="text-gray-600 mb-6">
            קיבלנו את הדיווח שלך עבור הזמנה #{order?.order_number}.
            <br />
            נציג יצור איתך קשר בהקדם לטיפול בבעיה.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={resetForm}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition"
            >
              דיווח נוסף
            </button>
            <Link
              href="/my-orders"
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition"
            >
              חזרה להזמנות שלי
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/my-orders"
          className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
        >
          ← חזרה להזמנות שלי
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">דיווח על תקלה</h1>
        <p className="text-gray-600 mt-1">
          נתקלת בבעיה עם ההזמנה? ספר לנו ונטפל בכך בהקדם
        </p>
      </div>

      {/* Order Lookup Section */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">חיפוש הזמנה</h2>

        <div className="flex gap-4">
          <div className="flex-1">
            <label htmlFor="orderNumber" className="block text-sm font-medium text-gray-700 mb-1">
              מספר הזמנה
            </label>
            <input
              type="text"
              id="orderNumber"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && lookupOrder()}
              placeholder="הזן מספר הזמנה"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              disabled={lookupLoading || !!order}
            />
          </div>
          <div className="flex items-end">
            {!order ? (
              <button
                onClick={lookupOrder}
                disabled={lookupLoading || !orderNumber.trim()}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {lookupLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    מחפש...
                  </span>
                ) : (
                  'חפש'
                )}
              </button>
            ) : (
              <button
                onClick={resetForm}
                className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition"
              >
                חיפוש אחר
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 whitespace-pre-line">{error}</p>
          </div>
        )}
      </div>

      {/* Order Details */}
      {order && (
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">פרטי הזמנה</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600">מספר הזמנה</p>
              <p className="font-semibold text-gray-900">#{order.order_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">משקל כולל</p>
              <p className="font-semibold text-gray-900">{order.total_weight_kg} ק&quot;ג</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">סכום כולל</p>
              <p className="font-semibold text-gray-900">{order.total_amount.toFixed(2)} ש&quot;ח</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">תאריך</p>
              <p className="font-semibold text-gray-900">
                {new Date(order.created_at).toLocaleDateString('he-IL')}
              </p>
            </div>
          </div>

          {order.distributor && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-600 mb-1">נקודת איסוף</p>
              <p className="font-semibold text-gray-900">{order.distributor.full_name}</p>
              {order.distributor.phone && (
                <p className="text-sm text-gray-600">{order.distributor.phone}</p>
              )}
            </div>
          )}

          {/* Order Items */}
          {order.items && order.items.length > 0 && (
            <div>
              <p className="text-sm text-gray-600 mb-2">פריטים בהזמנה</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">מוצר</th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">כמות</th>
                      <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">סה&quot;כ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {order.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2 text-gray-900">
                          {item.product?.name || 'מוצר'}
                          {item.product?.variety && (
                            <span className="text-sm text-gray-500"> ({item.product.variety})</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-900">{item.quantity_kg} ק&quot;ג</td>
                        <td className="px-4 py-2 text-gray-900">{item.subtotal.toFixed(2)} ש&quot;ח</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Fault Report Form */}
      {order && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">פרטי הדיווח</h2>

          {/* Return Reason */}
          <div className="mb-6">
            <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
              סוג הבעיה <span className="text-red-500">*</span>
            </label>
            <select
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReturnReason)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              disabled={submitting}
            >
              {RETURN_REASONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="mb-6">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              תיאור הבעיה <span className="text-red-500">*</span>
              <span className="text-gray-500 font-normal"> (לפחות 10 תווים)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="תאר את הבעיה בפירוט..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
              disabled={submitting}
            />
            <p className="text-sm text-gray-500 mt-1">
              {description.length}/10 תווים מינימום
            </p>
          </div>

          {/* Photo Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              תמונות
              <span className="text-gray-500 font-normal"> (עד {MAX_PHOTOS} תמונות, JPEG או PNG, עד 5MB כל אחת)</span>
            </label>

            {/* Photo Previews */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 mb-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                      <img
                        src={photo.preview}
                        alt="תצוגה מקדימה"
                        className="w-full h-full object-cover"
                      />

                      {/* Uploading overlay */}
                      {photo.uploading && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                          <svg className="animate-spin h-8 w-8 text-white" viewBox="0 0 24 24">
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="none"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        </div>
                      )}

                      {/* Uploaded overlay */}
                      {photo.uploaded && (
                        <div className="absolute top-2 right-2">
                          <div className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        </div>
                      )}

                      {/* Error overlay */}
                      {photo.error && (
                        <div className="absolute inset-0 bg-red-500 bg-opacity-75 flex items-center justify-center p-2">
                          <p className="text-white text-xs text-center">{photo.error}</p>
                        </div>
                      )}
                    </div>

                    {/* Remove button */}
                    {!submitting && !photo.uploading && (
                      <button
                        type="button"
                        onClick={() => removePhoto(photo.id)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Upload Button */}
            {photos.length < MAX_PHOTOS && (
              <label
                className={`
                  flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg
                  cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition
                  ${submitting ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  <svg
                    className="w-8 h-8 text-gray-400 mb-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-sm text-gray-600">
                    <span className="text-emerald-600 font-medium">לחץ להעלאה</span> או גרור תמונות
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {photos.length}/{MAX_PHOTOS} תמונות
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  multiple
                  onChange={handleFileSelect}
                  disabled={submitting}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Submit Error */}
          {submitError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800">{submitError}</p>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting || description.trim().length < 10}
              className="flex-1 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  שולח דיווח...
                </span>
              ) : (
                'שלח דיווח'
              )}
            </button>
            <Link
              href="/my-orders"
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-lg transition text-center"
            >
              ביטול
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}
