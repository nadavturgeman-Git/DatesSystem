import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import StockReceivedButton from '@/components/orders/StockReceivedButton';
import MarkAsPaidButton from '@/components/orders/MarkAsPaidButton';

interface PageProps {
  params: {
    id: string;
  };
}

export default async function OrderDetailPage({ params }: PageProps) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get order with distributor info and profile
  const { data: order } = await supabase
    .from('orders')
    .select(`
      *,
      profiles:distributor_id (full_name, email, phone),
      distributor_profiles:distributor_id (employment_model)
    `)
    .eq('id', params.id)
    .single();

  if (!order) {
    redirect('/orders');
  }

  // Get user profile to check role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  // Get order items with product details
  const { data: orderItems } = await supabase
    .from('order_items')
    .select(`
      *,
      products (name, variety, price_per_kg)
    `)
    .eq('order_id', params.id);

  // Get stock reservations
  const { data: reservations } = await supabase
    .from('stock_reservations')
    .select(`
      *,
      pallets (pallet_id, batch_number, entry_date),
      products (name, variety)
    `)
    .eq('order_id', params.id)
    .eq('is_active', true);

  // Calculate time remaining on reservation
  const reservationExpiresAt = order.reservation_expires_at
    ? new Date(order.reservation_expires_at)
    : null;
  const now = new Date();
  const minutesRemaining = reservationExpiresAt
    ? Math.max(0, Math.floor((reservationExpiresAt.getTime() - now.getTime()) / 60000))
    : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'shipped':
        return 'bg-purple-100 text-purple-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'ממתין';
      case 'confirmed':
        return 'אושר';
      case 'packed':
        return 'ארוז';
      case 'shipped':
        return 'נשלח';
      case 'delivered':
        return 'נמסר';
      case 'cancelled':
        return 'בוטל';
      default:
        return status;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/orders"
            className="text-sm text-gray-600 hover:text-gray-900 mb-2 inline-block"
          >
            ← חזרה להזמנות
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">הזמנה #{order.order_number}</h1>
          <p className="text-gray-600 mt-1">
            נוצר ב-{new Date(order.created_at).toLocaleDateString('he-IL')} בשעה{' '}
            {new Date(order.created_at).toLocaleTimeString('he-IL', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
        <div>
          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
            {getStatusText(order.status)}
          </span>
        </div>
      </div>

      {/* Reservation Timer */}
      {order.status === 'pending' && minutesRemaining > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏰</span>
            <div className="flex-1">
              <p className="font-semibold text-amber-900">המלאי שמור עבורך</p>
              <p className="text-sm text-amber-700">
                נותרו {minutesRemaining} דקות להשלמת התשלום
              </p>
            </div>
            <button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-6 py-2 rounded-lg transition">
              שלם עכשיו
            </button>
          </div>
        </div>
      )}

      {/* Order Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Info */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">פרטי לקוח</h2>
          <div className="space-y-2">
            <div>
              <span className="text-gray-600">שם:</span>
              <span className="font-semibold mr-2">{order.profiles?.full_name}</span>
            </div>
            <div>
              <span className="text-gray-600">אימייל:</span>
              <span className="mr-2">{order.profiles?.email}</span>
            </div>
            {order.profiles?.phone && (
              <div>
                <span className="text-gray-600">טלפון:</span>
                <span className="mr-2">{order.profiles.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Order Summary */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">סיכום הזמנה</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">משקל כולל:</span>
              <span className="font-semibold">{order.total_weight_kg} ק"ג</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">סכום חלקי:</span>
              <span className="font-semibold">₪{order.subtotal?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-emerald-600">
              <span>עמלה:</span>
              <span className="font-semibold">₪{order.commission_amount?.toFixed(2)}</span>
            </div>
            <div className="border-t border-gray-200 pt-3">
              <div className="flex justify-between text-lg font-bold">
                <span>סה"כ:</span>
                <span>₪{order.total_amount?.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">פריטים בהזמנה</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  מוצר
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  זן
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  כמות
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  מחיר לק"ג
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  סה"כ
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orderItems?.map((item: any) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.products?.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {item.products?.variety}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.quantity_kg} ק"ג
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ₪{item.price_per_kg}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    ₪{item.subtotal?.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FIFO Allocation (Stock Reservations) */}
      {reservations && reservations.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">הקצאת פלטות (FIFO)</h2>
          <p className="text-sm text-gray-600 mb-4">
            המערכת הקצתה את הפלטות הבאות לפי שיטת First-In-First-Out:
          </p>
          <div className="space-y-3">
            {reservations.map((reservation: any) => (
              <div
                key={reservation.id}
                className="border border-gray-200 rounded-lg p-4 flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-semibold text-gray-900">
                      {reservation.products?.name}
                    </span>
                    <span className="text-sm text-gray-600">
                      פלטה: {reservation.pallets?.pallet_id}
                    </span>
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {reservation.pallets?.batch_number}
                    </span>
                  </div>
                  <div className="flex gap-6 text-sm text-gray-600">
                    <span>
                      כמות שמורה: <strong>{reservation.reserved_weight_kg} ק"ג</strong>
                    </span>
                    <span>
                      תאריך כניסה:{' '}
                      {new Date(reservation.pallets?.entry_date).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                </div>
                <div className="text-left">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                    ✓ שמור
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mark as Paid Button (for Cash_Paybox distributors) */}
      {profile?.role === 'distributor' && order.distributor_id === user.id && (
        <MarkAsPaidButton
          orderId={order.id}
          paymentStatus={order.payment_status}
          employmentModel={(order as any).distributor_profiles?.employment_model}
          isDistributor={true}
        />
      )}

      {/* Stock Received Button (for distributors) */}
      {profile?.role === 'distributor' && order.distributor_id === user.id && (
        <StockReceivedButton
          orderId={order.id}
          deliveryStatus={order.delivery_status}
          isDistributor={true}
        />
      )}

      {/* Notes */}
      {order.notes && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">הערות</h2>
          <p className="text-gray-700">{order.notes}</p>
        </div>
      )}
    </div>
  );
}
