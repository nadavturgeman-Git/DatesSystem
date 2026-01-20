'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface Product {
  id: string
  name: string
  variety?: string
  description?: string
  price_per_kg: number
  available_stock?: number
}

interface Distributor {
  id: string
  full_name: string
  email: string
  phone?: string
  pickup_location?: string
  city?: string
}

export default function PublicOrderPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()
  const distributorId = params.distributorId as string

  const [products, setProducts] = useState<Product[]>([])
  const [distributor, setDistributor] = useState<Distributor | null>(null)
  const [cart, setCart] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [showCheckout, setShowCheckout] = useState(false)
  const [customerInfo, setCustomerInfo] = useState({
    full_name: '',
    phone: '',
    email: '',
  })
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'bit' | 'paybox' | 'cash' | null>(null)
  const [isReturningCustomer, setIsReturningCustomer] = useState(false)
  const [lookingUpCustomer, setLookingUpCustomer] = useState(false)
  const [salesCycleClosed, setSalesCycleClosed] = useState(false)
  const [nextCycleDate, setNextCycleDate] = useState<string | null>(null)
  const [showConfirmationBanner, setShowConfirmationBanner] = useState(false)

  // Check if user came from distributor selection page
  useEffect(() => {
    const distParam = searchParams.get('dist')
    if (distParam === 'selected') {
      setShowConfirmationBanner(true)
    }
  }, [searchParams])

  useEffect(() => {
    loadData()
    // Load cart from sessionStorage
    const cartData = sessionStorage.getItem(`cart_${distributorId}`)
    if (cartData) {
      try {
        const cartObj = JSON.parse(cartData)
        setCart(new Map(Object.entries(cartObj).map(([k, v]) => [k, Number(v)])))
      } catch (e) {
        console.error('Error loading cart:', e)
      }
    }
  }, [distributorId])

  async function loadData() {
    setLoading(true)
    try {
      // Get active products via API
      const productsResponse = await fetch('/api/catalog/products')
      const productsData = await productsResponse.json()
      
      if (!productsResponse.ok) {
        throw new Error(productsData.error || 'שגיאה בטעינת מוצרים')
      }
      setProducts(productsData.products || [])

      // Get distributor info via API
      const distributorResponse = await fetch(`/api/catalog/distributors`)
      const distributorsData = await distributorResponse.json()
      
      if (!distributorResponse.ok) {
        throw new Error(distributorsData.error || 'שגיאה בטעינת מפיץ')
      }

      const foundDistributor = distributorsData.distributors?.find(
        (d: Distributor) => d.id === distributorId
      )

      if (!foundDistributor) {
        throw new Error('מפיץ לא נמצא')
      }

      setDistributor(foundDistributor)

      // Check if sales cycle is active
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()

      const { data: activeCycle } = await supabase
        .from('sales_cycles')
        .select('*')
        .eq('is_active', true)
        .single()

      if (!activeCycle) {
        // No active cycle - check for next cycle
        const { data: nextCycle } = await supabase
          .from('sales_cycles')
          .select('start_date, name')
          .gt('start_date', new Date().toISOString())
          .order('start_date', { ascending: true })
          .limit(1)
          .single()

        if (nextCycle) {
          setNextCycleDate(nextCycle.start_date)
        }
        setSalesCycleClosed(true)
      } else {
        setSalesCycleClosed(false)
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  function handleConfirmPickupLocation() {
    setShowConfirmationBanner(false)
    // Remove the query param from URL without causing a navigation
    window.history.replaceState({}, '', `/order/${distributorId}`)
  }

  function handleChooseDifferentLocation() {
    router.push('/order')
  }

  function addToCart(productId: string, quantity: number) {
    const newCart = new Map(cart)
    const currentQty = newCart.get(productId) || 0
    newCart.set(productId, currentQty + quantity)
    setCart(newCart)
    // Save to sessionStorage
    const cartObj = Object.fromEntries(newCart)
    sessionStorage.setItem(`cart_${distributorId}`, JSON.stringify(cartObj))
  }

  function updateCartQuantity(productId: string, quantity: number) {
    const newCart = new Map(cart)
    if (quantity <= 0) {
      newCart.delete(productId)
    } else {
      newCart.set(productId, quantity)
    }
    setCart(newCart)
    // Save to sessionStorage
    const cartObj = Object.fromEntries(newCart)
    sessionStorage.setItem(`cart_${distributorId}`, JSON.stringify(cartObj))
  }

  async function lookupCustomerByPhone(phone: string) {
    // Only lookup if phone has at least 9 digits
    const digitsOnly = phone.replace(/\D/g, '')
    if (digitsOnly.length < 9) {
      setIsReturningCustomer(false)
      return
    }

    setLookingUpCustomer(true)
    try {
      const response = await fetch('/api/customers/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })

      const data = await response.json()

      if (response.ok && data.customer) {
        // Customer found - auto-fill their data
        setCustomerInfo({
          full_name: data.customer.full_name,
          phone: data.customer.phone,
          email: data.customer.email || '',
        })
        setIsReturningCustomer(true)
      } else {
        setIsReturningCustomer(false)
      }
    } catch (err) {
      console.error('Error looking up customer:', err)
      setIsReturningCustomer(false)
    } finally {
      setLookingUpCustomer(false)
    }
  }

  async function handleSubmitOrder() {
    if (!distributor || cart.size === 0) return

    if (!customerInfo.full_name || !customerInfo.phone) {
      setError('יש למלא שם וטלפון')
      return
    }

    if (!paymentMethod) {
      setError('יש לבחור אמצעי תשלום')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      const items = Array.from(cart.entries()).map(([productId, qty]) => ({
        productId,
        quantity: qty,
      }))

      // Create public order via API
      const response = await fetch('/api/orders/create-public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distributorId: distributor.id,
          items,
          customerInfo: {
            full_name: customerInfo.full_name,
            phone: customerInfo.phone,
            email: customerInfo.email || null,
          },
          paymentMethod: paymentMethod,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה ביצירת הזמנה')
      }

      // Clear cart
      sessionStorage.removeItem(`cart_${distributorId}`)

      // Redirect to confirmation page
      router.push(`/order/${distributorId}/confirmation?orderId=${data.order.id}`)
    } catch (err: any) {
      setError(err.message)
      console.error('Error creating order:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const cartTotal = Array.from(cart.entries()).reduce((sum, [productId, qty]) => {
    const product = products.find(p => p.id === productId)
    return sum + (product ? product.price_per_kg * qty : 0)
  }, 0)

  const cartItems = Array.from(cart.entries()).map(([productId, qty]) => {
    const product = products.find(p => p.id === productId)
    return product ? { product, quantity: qty } : null
  }).filter(Boolean)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען מוצרים...</p>
        </div>
      </div>
    )
  }

  if (error && !distributor) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center max-w-md mx-auto px-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800 text-lg font-semibold mb-2">שגיאה</p>
            <p className="text-red-600">{error}</p>
            <Link
              href="/"
              className="mt-4 inline-block px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              חזרה לדף הבית
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Pickup Location Confirmation Banner */}
      {showConfirmationBanner && distributor && (
        <div className="bg-emerald-50 border-b-2 border-emerald-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-right">
                <h2 className="text-lg font-semibold text-emerald-800 mb-1">
                  האם זו נקודת האיסוף הנכונה?
                </h2>
                <p className="text-emerald-700">
                  <span className="font-medium">{distributor.full_name}</span>
                  {(distributor.pickup_location || distributor.city) && (
                    <span> - {distributor.pickup_location || distributor.city}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleChooseDifferentLocation}
                  className="px-4 py-2 text-emerald-700 border border-emerald-600 rounded-lg hover:bg-emerald-100 font-medium transition-colors"
                >
                  בחר נקודת איסוף אחרת
                </button>
                <button
                  onClick={handleConfirmPickupLocation}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium transition-colors"
                >
                  כן, המשך
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">הזמנת תמרים</h1>
              {distributor && (
                <p className="text-sm text-gray-600 mt-1">
                  נקודת איסוף: {distributor.full_name}
                  {distributor.pickup_location && ` - ${distributor.pickup_location}`}
                  {distributor.city && !distributor.pickup_location && ` - ${distributor.city}`}
                </p>
              )}
            </div>
            {cart.size > 0 && (
              <button
                onClick={() => setShowCheckout(true)}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 relative"
              >
                עגלה ({cart.size})
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {cart.size}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Sales Cycle Closed Message */}
      {salesCycleClosed && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">מחזור מכירות סגור</h2>
            <p className="text-gray-700 text-lg mb-6">
              ההזמנות סגורות כרגע. אנא חזור במחזור המכירות הבא.
            </p>
            {nextCycleDate && (
              <div className="bg-white rounded-lg p-4 inline-block">
                <p className="text-sm text-gray-600 mb-1">המחזור הבא מתחיל ב:</p>
                <p className="text-xl font-bold text-emerald-600">
                  {new Date(nextCycleDate).toLocaleDateString('he-IL', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            )}
            <div className="mt-6">
              <Link
                href="/"
                className="inline-block px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
              >
                חזרה לדף הבית
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Products Grid */}
      {!salesCycleClosed && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product) => {
            const cartQty = cart.get(product.id) || 0
            return (
              <div key={product.id} className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{product.name}</h3>
                  {product.variety && (
                    <p className="text-sm text-gray-600 mb-2">זן: {product.variety}</p>
                  )}
                  {product.description && (
                    <p className="text-sm text-gray-700 mb-4">{product.description}</p>
                  )}
                  <p className="text-2xl font-bold text-emerald-600 mb-4">
                    ₪{product.price_per_kg} לק"ג
                  </p>
                  
                  {cartQty > 0 ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateCartQuantity(product.id, cartQty - 0.5)}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        value={cartQty}
                        onChange={(e) => updateCartQuantity(product.id, parseFloat(e.target.value) || 0)}
                        min="0"
                        step="0.5"
                        className="w-20 px-3 py-1 border border-gray-300 rounded text-center"
                      />
                      <span className="text-sm text-gray-600">ק"ג</span>
                      <button
                        onClick={() => updateCartQuantity(product.id, cartQty + 0.5)}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        +
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(product.id, 1)}
                      className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      הוסף לעגלה
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      )}

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">סיכום הזמנה</h2>
            
            {/* Order Summary */}
            <div className="mb-6 space-y-3">
              {cartItems.map((item: any) => (
                <div key={item.product.id} className="flex justify-between items-center border-b pb-2">
                  <div>
                    <p className="font-semibold text-gray-900">{item.product.name}</p>
                    <p className="text-sm text-gray-600">{item.quantity} ק"ג × ₪{item.product.price_per_kg}</p>
                  </div>
                  <p className="font-semibold text-gray-900">
                    ₪{(item.product.price_per_kg * item.quantity).toFixed(2)}
                  </p>
                </div>
              ))}
              <div className="pt-2 border-t">
                <div className="flex justify-between items-center">
                  <p className="text-lg font-semibold text-gray-900">סה"כ</p>
                  <p className="text-2xl font-bold text-emerald-600">₪{cartTotal.toFixed(2)}</p>
                </div>
              </div>
            </div>

            {/* Customer Info Form */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">פרטי יצירת קשר</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    שם מלא *
                  </label>
                  <input
                    type="text"
                    value={customerInfo.full_name}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, full_name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    טלפון *
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      value={customerInfo.phone}
                      onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                      onBlur={(e) => lookupCustomerByPhone(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      placeholder="050-1234567"
                      required
                    />
                    {lookingUpCustomer && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                      </div>
                    )}
                  </div>
                  {isReturningCustomer && (
                    <p className="mt-1 text-sm text-emerald-600 flex items-center gap-1">
                      <span>✓</span>
                      <span>לקוח חוזר - הפרטים הושלמו אוטומטית</span>
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    אימייל (אופציונלי)
                  </label>
                  <input
                    type="email"
                    value={customerInfo.email}
                    onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Selection */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">אמצעי תשלום *</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('credit_card')}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${
                    paymentMethod === 'credit_card'
                      ? 'border-emerald-600 bg-emerald-50 shadow-md'
                      : 'border-gray-300 hover:border-gray-400 bg-white'
                  }`}
                >
                  <div className="text-2xl mb-2">💳</div>
                  <div className="font-semibold text-gray-900">כרטיס אשראי</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('bit')}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${
                    paymentMethod === 'bit'
                      ? 'border-emerald-600 bg-emerald-50 shadow-md'
                      : 'border-gray-300 hover:border-gray-400 bg-white'
                  }`}
                >
                  <div className="text-2xl mb-2">📱</div>
                  <div className="font-semibold text-gray-900">Bit</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('paybox')}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${
                    paymentMethod === 'paybox'
                      ? 'border-emerald-600 bg-emerald-50 shadow-md'
                      : 'border-gray-300 hover:border-gray-400 bg-white'
                  }`}
                >
                  <div className="text-2xl mb-2">📦</div>
                  <div className="font-semibold text-gray-900">Paybox</div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-4 border-2 rounded-lg text-center transition-all ${
                    paymentMethod === 'cash'
                      ? 'border-emerald-600 bg-emerald-50 shadow-md'
                      : 'border-gray-300 hover:border-gray-400 bg-white'
                  }`}
                >
                  <div className="text-2xl mb-2">💵</div>
                  <div className="font-semibold text-gray-900">מזומן</div>
                </button>
              </div>
            </div>

            {/* Distributor Info */}
            {distributor && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-semibold text-gray-700 mb-1">נקודת איסוף:</p>
                <p className="text-gray-900">{distributor.full_name}</p>
                {distributor.pickup_location && (
                  <p className="text-sm text-gray-600 mt-1">📍 {distributor.pickup_location}</p>
                )}
                {distributor.city && !distributor.pickup_location && (
                  <p className="text-sm text-gray-600 mt-1">📍 {distributor.city}</p>
                )}
                {distributor.phone && (
                  <p className="text-sm text-gray-600 mt-1">📞 {distributor.phone}</p>
                )}
              </div>
            )}

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setShowCheckout(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
              >
                ביטול
              </button>
              <button
                onClick={handleSubmitOrder}
                disabled={submitting || !customerInfo.full_name || !customerInfo.phone}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? 'יוצר הזמנה...' : 'אשר הזמנה'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Summary (Floating) */}
      {cart.size > 0 && !showCheckout && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">סה"כ {cartItems.length} מוצרים</p>
                <p className="text-xl font-bold text-gray-900">₪{cartTotal.toFixed(2)}</p>
              </div>
              <button
                onClick={() => setShowCheckout(true)}
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
              >
                המשך לתשלום
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
