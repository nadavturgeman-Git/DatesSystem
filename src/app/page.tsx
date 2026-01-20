import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If user is logged in, redirect to dashboard
  if (user) {
    redirect('/dashboard');
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          {/* Hero Section */}
          <div className="mb-12">
            <div className="text-6xl mb-4">🌴</div>
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              מערכת ניהול חוות תמרים
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              מערכת מקיפה לניהול מלאי, מפיצים, הזמנות וחישוב עמלות
            </p>

            <div className="flex items-center justify-center gap-4 flex-wrap">
              <Link
                href="/catalog"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-8 py-3 rounded-lg transition"
              >
                🛒 הזמן תמרים
              </Link>
              <Link
                href="/login"
                className="bg-white hover:bg-gray-50 text-emerald-600 border-2 border-emerald-600 font-semibold px-8 py-3 rounded-lg transition"
              >
                התחבר למערכת
              </Link>
              <Link
                href="/signup"
                className="bg-white hover:bg-gray-50 text-emerald-600 border-2 border-emerald-600 font-semibold px-8 py-3 rounded-lg transition"
              >
                הירשם
              </Link>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="text-4xl mb-4">📦</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">ניהול מלאי FIFO</h3>
              <p className="text-gray-600">
                מערכת FIFO אוטומטית להקצאת פלטות לפי תאריך כניסה
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">חישוב עמלות דינמי</h3>
              <p className="text-gray-600">
                עמלות מדורגות אוטומטיות למפיצים וראשי צוותים
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="text-4xl mb-4">🚚</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">דפי משלוח</h3>
              <p className="text-gray-600">
                יצירה אוטומטית של דפי משלוח לנהגים
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
