'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

export default function CustomerCatalogPage() {
  const supabase = createClient()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedDistributor, setSelectedDistributor] = useState<Distributor | null>(null)
  const [distributors, setDistributors] = useState<Distributor[]>([])
  const [cart, setCart] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [showDistributorSelector, setShowDistributorSelector] = useState(false)

  useEffect(() => {
    loadData()
    // Load cart from sessionStorage
    const cartData = sessionStorage.getItem('cart')
    if (cartData) {
      try {
        const cartObj = JSON.parse(cartData)
        setCart(new Map(Object.entries(cartObj).map(([k, v]) => [k, Number(v)])))
      } catch (e) {
        console.error('Error loading cart:', e)
      }
    }
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // Get active products via API (bypasses RLS)
      const productsResponse = await fetch('/api/catalog/products')
      const productsData = await productsResponse.json()
      
      if (!productsResponse.ok) {
        throw new Error(productsData.error || 'שגיאה בטעינת מוצרים')
      }
      setProducts(productsData.products || [])

      // Get available distributors via API (bypasses RLS)
      const distributorsResponse = await fetch('/api/catalog/distributors')
      const distributorsData = await distributorsResponse.json()
      
      if (!distributorsResponse.ok) {
        throw new Error(distributorsData.error || 'שגיאה בטעינת מפיצים')
      }
      setDistributors(distributorsData.distributors || [])

      // Check if distributor is selected in session
      const storedDistributorId = sessionStorage.getItem('selectedDistributorId')
      if (storedDistributorId) {
        const distributor = distributorsData.distributors?.find((d: Distributor) => d.id === storedDistributorId)
        if (distributor) {
          setSelectedDistributor(distributor)
        }
      }
    } catch (error: any) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  function selectDistributor(distributor: Distributor) {
    setSelectedDistributor(distributor)
    sessionStorage.setItem('selectedDistributorId', distributor.id)
    setShowDistributorSelector(false)
  }

  function addToCart(productId: string, quantity: number) {
    const newCart = new Map(cart)
    const currentQty = newCart.get(productId) || 0
    newCart.set(productId, currentQty + quantity)
    setCart(newCart)
    // Save to sessionStorage
    const cartObj = Object.fromEntries(newCart)
    sessionStorage.setItem('cart', JSON.stringify(cartObj))
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
    sessionStorage.setItem('cart', JSON.stringify(cartObj))
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">טוען מוצרים...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">קטלוג תמרים</h1>
            <div className="flex items-center gap-4">
              {selectedDistributor ? (
                <div className="text-right">
                  <p className="text-sm text-gray-600">נקודת איסוף:</p>
                  <p className="font-semibold text-gray-900">{selectedDistributor.full_name}</p>
                  {selectedDistributor.pickup_location && (
                    <p className="text-xs text-gray-500 mt-1">📍 {selectedDistributor.pickup_location}</p>
                  )}
                  {selectedDistributor.city && !selectedDistributor.pickup_location && (
                    <p className="text-xs text-gray-500 mt-1">📍 {selectedDistributor.city}</p>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowDistributorSelector(true)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  בחר נקודת איסוף
                </button>
              )}
              {cart.size > 0 && (
                <Link
                  href="/checkout"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 relative"
                >
                  עגלה ({cart.size})
                  <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {cart.size}
                  </span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Distributor Selector Modal */}
      {showDistributorSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">בחר נקודת איסוף</h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {distributors.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>לא נמצאו נקודות איסוף</p>
                  <p className="text-sm mt-2">יש להוסיף מפיצים דרך ניהול משתמשים</p>
                </div>
              ) : (
                distributors.map((distributor) => (
                  <button
                    key={distributor.id}
                    onClick={() => selectDistributor(distributor)}
                    className="w-full text-right p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-emerald-300 transition"
                  >
                    <p className="font-semibold text-gray-900">{distributor.full_name}</p>
                    {distributor.pickup_location && (
                      <p className="text-sm text-gray-600 mt-1">📍 {distributor.pickup_location}</p>
                    )}
                    {distributor.city && !distributor.pickup_location && (
                      <p className="text-sm text-gray-600 mt-1">📍 {distributor.city}</p>
                    )}
                    {distributor.phone && (
                      <p className="text-sm text-gray-500 mt-1">📞 {distributor.phone}</p>
                    )}
                  </button>
                ))
              )}
            </div>
            <button
              onClick={() => setShowDistributorSelector(false)}
              className="mt-4 w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Warning if no distributor selected */}
      {!selectedDistributor && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">
              ⚠️ יש לבחור נקודת איסוף לפני הוספת מוצרים לעגלה
            </p>
            {distributors.length === 0 && (
              <p className="text-yellow-700 text-sm mt-2">
                💡 לא נמצאו נקודות איסוף במערכת. יש להוסיף מפיצים דרך ניהול משתמשים.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Products Grid */}
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
                    ₪{product.price_per_kg} לק&quot;ג
                  </p>
                  
                  {cartQty > 0 ? (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => updateCartQuantity(product.id, cartQty - 1)}
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
                      <span className="text-sm text-gray-600">ק&quot;ג</span>
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
                      disabled={!selectedDistributor}
                      className={`w-full px-4 py-2 rounded-lg font-semibold transition-colors ${
                        selectedDistributor
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      }`}
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

      {/* Cart Summary (Floating) */}
      {cart.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">סה&quot;כ {cartItems.length} מוצרים</p>
                <p className="text-xl font-bold text-gray-900">₪{cartTotal.toFixed(2)}</p>
              </div>
              <Link
                href="/checkout"
                className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-semibold"
              >
                המשך לתשלום
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
