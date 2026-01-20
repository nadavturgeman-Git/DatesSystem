'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
// Payment config will be loaded via API

interface CartItem {
  product: {
    id: string
    name: string
    variety?: string
    price_per_kg: number
  }
  quantity: number
}

export default function CustomerCheckoutPage() {
  const supabase = createClient()
  const router = useRouter()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [selectedDistributor, setSelectedDistributor] = useState<any>(null)
  const [paymentConfig, setPaymentConfig] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [customerData, setCustomerData] = useState<{
    full_name?: string
    phone?: string
    email?: string
    address?: string
  }>({})

  useEffect(() => {
    loadCheckoutData()
  }, [])

  async function loadCheckoutData() {
    setLoading(true)
    try {
      // Get cart from session storage
      const cartData = sessionStorage.getItem('cart')
      const distributorId = sessionStorage.getItem('selectedDistributorId')

      if (!cartData || !distributorId) {
        router.push('/catalog')
        return
      }

      const cart = JSON.parse(cartData)
      const productIds = Object.keys(cart)

      // Get products via API (bypasses RLS)
      const productsResponse = await fetch('/api/checkout/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds }),
      })
      const productsData = await productsResponse.json()
      
      if (!productsResponse.ok) {
        throw new Error(productsData.error || 'שגיאה בטעינת מוצרים')
      }

      const items: CartItem[] = productIds.map(productId => {
        const product = productsData.products?.find((p: any) => p.id === productId)
        return {
          product: product!,
          quantity: cart[productId],
        }
      }).filter(item => item.product)

      setCartItems(items)

      // Get distributor via API (bypasses RLS)
      const distributorResponse = await fetch(`/api/checkout/distributor?distributorId=${distributorId}`)
      const distributorData = await distributorResponse.json()
      
      if (!distributorResponse.ok) {
        throw new Error(distributorData.error || 'שגיאה בטעינת מפיץ')
      }

      setSelectedDistributor(distributorData.distributor)

      // Get payment config via API
      const configResponse = await fetch(`/api/checkout/payment-config?distributorId=${distributorId}`)
      const config = await configResponse.json()
      if (configResponse.ok) {
        setPaymentConfig(config)
      } else {
        console.error('Error loading payment config:', config.error)
        // Default config
        setPaymentConfig({
          employmentModel: 'Credit_Commission',
          showPayboxLink: false,
          showCreditCard: true,
          showCashOption: false,
          message: 'תשלום בכרטיס אשראי',
        })
      }

      // Check for returning customer and pre-fill data
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email || user?.phone) {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('full_name, phone, email, address')
          .or(`email.eq.${user.email || ''},phone.eq.${user.phone || ''}`)
          .single()

        if (existingCustomer) {
          setCustomerData({
            full_name: existingCustomer.full_name || user.user_metadata?.full_name,
            phone: existingCustomer.phone || user.phone,
            email: existingCustomer.email || user.email,
            address: existingCustomer.address,
          })
        }
      }
    } catch (error: any) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitOrder() {
    if (!selectedDistributor || cartItems.length === 0) return

    setSubmitting(true)
    setError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login?redirect=/checkout')
        return
      }

      // Prepare order items for API
      const items = cartItems.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
      }))

      // Create order via API (bypasses RLS and handles virtual lock)
      const response = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distributorId: selectedDistributor.id,
          items,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'שגיאה ביצירת הזמנה')
      }

      // Clear cart
      sessionStorage.removeItem('cart')
      sessionStorage.removeItem('selectedDistributorId')

      // Redirect to order confirmation
      router.push(`/my-orders/${data.order.id}/confirmation`)
    } catch (err: any) {
      setError(err.message)
      console.error('Error creating order:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const totalWeight = cartItems.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = cartItems.reduce((sum, item) => sum + item.product.price_per_kg * item.quantity, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">טוען...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">תשלום</h1>

        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">סיכום הזמנה</h2>
          <div className="space-y-3">
            {cartItems.map((item) => (
              <div key={item.product.id} className="flex justify-between items-center">
                <div>
                  <p className="font-semibold text-gray-900">{item.product.name}</p>
                  <p className="text-sm text-gray-600">{item.quantity} ק&quot;ג × ₪{item.product.price_per_kg}</p>
                </div>
                <p className="font-semibold text-gray-900">
                  ₪{(item.product.price_per_kg * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between items-center">
              <p className="text-lg font-semibold text-gray-900">סה&quot;כ</p>
              <p className="text-2xl font-bold text-emerald-600">₪{subtotal.toFixed(2)}</p>
            </div>
            <p className="text-sm text-gray-600 mt-2">סה&quot;כ משקל: {totalWeight.toFixed(2)} ק&quot;ג</p>
          </div>
        </div>

        {/* Customer Info (Pre-filled for returning customers) */}
        {customerData.full_name && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">פרטי לקוח (מולא אוטומטית)</h2>
            <div className="space-y-2">
              <p className="font-semibold text-gray-900">{customerData.full_name}</p>
              {customerData.phone && (
                <p className="text-gray-600">טלפון: {customerData.phone}</p>
              )}
              {customerData.email && (
                <p className="text-gray-600">אימייל: {customerData.email}</p>
              )}
              {customerData.address && (
                <p className="text-gray-600">כתובת: {customerData.address}</p>
              )}
            </div>
          </div>
        )}

        {/* Distributor Info */}
        {selectedDistributor && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">נקודת איסוף</h2>
            <p className="font-semibold text-gray-900">{selectedDistributor.full_name}</p>
            {selectedDistributor.phone && (
              <p className="text-gray-600">{selectedDistributor.phone}</p>
            )}
          </div>
        )}

        {/* Payment Method */}
        {paymentConfig && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">שיטת תשלום</h2>
            <p className="text-gray-700 mb-4">{paymentConfig.message}</p>
            
            {paymentConfig.showPayboxLink && paymentConfig.payboxLink && (
              <div className="mt-4">
                <a
                  href={paymentConfig.payboxLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                >
                  תשלום דרך Paybox
                </a>
              </div>
            )}

            {paymentConfig.showCreditCard && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">
                  תשלום באשראי - חשבונית תיווצר אוטומטית לאחר התשלום
                </p>
                <button
                  onClick={handleSubmitOrder}
                  disabled={submitting}
                  className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold disabled:bg-gray-400"
                >
                  {submitting ? 'יוצר הזמנה...' : 'אשר הזמנה'}
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
