'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function DistributorPublicLinkPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [publicOrderLink, setPublicOrderLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        window.location.href = '/login'
        return
      }

      setUser(currentUser)

      // Get profile to verify role
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single()

      if (profileData?.role !== 'distributor') {
        window.location.href = '/dashboard'
        return
      }

      // Set public order link
      const baseUrl = window.location.origin
      setPublicOrderLink(`${baseUrl}/order/${currentUser.id}`)
    } catch (error: any) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (err) {
        alert('לא ניתן להעתיק. אנא העתק ידנית.')
      }
      document.body.removeChild(textArea)
    }
  }

  const shareToWhatsApp = () => {
    if (!publicOrderLink) return
    const message = `🌴 הזמנת תמרים טריים!\n\nלהזמנה ישירה ללא התחברות:\n${publicOrderLink}\n\n✅ מבחר רחב של תמרים איכותיים\n✅ מחירים מעולים\n✅ איסוף מהיר מנקודת האיסוף`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  const shareNative = async () => {
    if (!publicOrderLink || !navigator.share) return
    
    try {
      await navigator.share({
        title: 'הזמנת תמרים',
        text: '🌴 הזמנת תמרים טריים! להזמנה ישירה ללא התחברות',
        url: publicOrderLink,
      })
    } catch (err) {
      // User cancelled or error
      console.log('Share cancelled')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
          <p className="text-gray-600">טוען...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">קישור הזמנה ציבורי</h1>
            <p className="text-gray-600">
              שתף את הקישור הזה עם הלקוחות שלך כדי שיוכלו להזמין תמרים ישירות ללא התחברות
            </p>
          </div>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
          >
            חזרה לדשבורד
          </Link>
        </div>
      </div>

      {/* Main Card */}
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg shadow-lg p-8 text-white">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">🔗 הקישור שלך להזמנות</h2>
          <p className="text-emerald-50">
            כל הזמנה דרך הקישור הזה תירשם תחת השם שלך במערכת
          </p>
        </div>

        {/* Link Display */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="text"
              value={publicOrderLink || ''}
              readOnly
              className="flex-1 min-w-[300px] bg-white/20 text-white placeholder-white/70 px-4 py-3 rounded-lg border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 font-mono text-sm"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={() => publicOrderLink && copyToClipboard(publicOrderLink)}
              className={`px-6 py-3 rounded-lg font-semibold transition whitespace-nowrap flex items-center gap-2 ${
                copied
                  ? 'bg-green-500 text-white'
                  : 'bg-white text-emerald-600 hover:bg-emerald-50'
              }`}
            >
              {copied ? '✅ הועתק!' : '📋 העתק קישור'}
            </button>
          </div>
        </div>

        {/* Share Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={shareToWhatsApp}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg font-semibold transition flex items-center gap-2"
          >
            📱 שתף בווטסאפ
          </button>
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <button
              onClick={shareNative}
              className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg font-semibold transition flex items-center gap-2"
            >
              🔗 שתף
            </button>
          )}
          <a
            href={`mailto:?subject=הזמנת תמרים&body=${encodeURIComponent(`🌴 הזמנת תמרים טריים!\n\nלהזמנה ישירה:\n${publicOrderLink || ''}`)}`}
            className="px-6 py-3 bg-white/20 hover:bg-white/30 rounded-lg font-semibold transition flex items-center gap-2"
          >
            📧 שתף באימייל
          </a>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* How it works */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            💡 איך זה עובד?
          </h3>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold">1.</span>
              <span>העתק את הקישור או שתף אותו ישירות</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold">2.</span>
              <span>הלקוח לוחץ על הקישור ונכנס לדף הזמנה</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold">3.</span>
              <span>הלקוח בוחר מוצרים וממלא פרטים</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600 font-bold">4.</span>
              <span>ההזמנה נוצרת במערכת תחת השם שלך</span>
            </li>
          </ul>
        </div>

        {/* Tips */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            ✨ טיפים לשימוש
          </h3>
          <ul className="space-y-2 text-gray-700">
            <li className="flex items-start gap-2">
              <span className="text-emerald-600">•</span>
              <span>הקישור תמיד זמין - אין צורך ליצור קישור חדש</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600">•</span>
              <span>אפשר לשתף את הקישור בקבוצות ווטסאפ, SMS, או אימייל</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600">•</span>
              <span>כל ההזמנות מופיעות בדף ההזמנות שלך</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-600">•</span>
              <span>הלקוח לא צריך ליצור חשבון - רק למלא פרטים</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Example Message */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">📝 דוגמה להודעת ווטסאפ</h3>
        <div className="bg-white rounded-lg p-4 border border-blue-200">
          <p className="text-gray-800 whitespace-pre-line">
{`🌴 הזמנת תמרים טריים! 🌴

להזמנה ישירה ללא התחברות:
${publicOrderLink || '[הקישור שלך]'}

✅ מבחר רחב של תמרים איכותיים
✅ מחירים מעולים
✅ איסוף מהיר מנקודת האיסוף

לשאלות: [הטלפון שלך]`}
          </p>
        </div>
        <button
          onClick={() => {
            const message = `🌴 הזמנת תמרים טריים! 🌴\n\nלהזמנה ישירה ללא התחברות:\n${publicOrderLink || ''}\n\n✅ מבחר רחב של תמרים איכותיים\n✅ מחירים מעולים\n✅ איסוף מהיר מנקודת האיסוף\n\nלשאלות: [הטלפון שלך]`
            copyToClipboard(message)
          }}
          className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
        >
          📋 העתק הודעה מוכנה
        </button>
      </div>
    </div>
  )
}
