import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Map API return_reason values to database enum values
type ApiReturnReason = 'Damaged_Product' | 'Missing_Items' | 'Quality_Issue' | 'Other';
type DbReturnReason = 'damaged' | 'missed_collection' | 'quality_issue' | 'other';

const returnReasonMap: Record<ApiReturnReason, DbReturnReason> = {
  'Damaged_Product': 'damaged',
  'Missing_Items': 'missed_collection', // Using missed_collection for missing items
  'Quality_Issue': 'quality_issue',
  'Other': 'other',
};

interface FaultReportRequest {
  order_id: string;
  return_reason: ApiReturnReason;
  description: string;
  image_urls: string[];
}

export async function POST(request: NextRequest) {
  try {
    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase credentials');
      return NextResponse.json(
        { error: 'שגיאת שרת: חסרים פרטי התחברות למסד הנתונים' },
        { status: 500 }
      );
    }

    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    let body: FaultReportRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'שגיאה בפורמט הבקשה: יש לשלוח JSON תקין' },
        { status: 400 }
      );
    }

    const { order_id, return_reason, description, image_urls } = body;

    // ==========================================
    // VALIDATION
    // ==========================================

    // Check required fields
    if (!order_id) {
      return NextResponse.json(
        { error: 'מספר הזמנה הוא שדה חובה' },
        { status: 400 }
      );
    }

    if (!return_reason) {
      return NextResponse.json(
        { error: 'סיבת התקלה היא שדה חובה' },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        { error: 'תיאור התקלה הוא שדה חובה' },
        { status: 400 }
      );
    }

    if (!image_urls) {
      return NextResponse.json(
        { error: 'יש לצרף לפחות תמונה אחת של התקלה' },
        { status: 400 }
      );
    }

    // Validate return_reason is a valid value
    const validReasons: ApiReturnReason[] = ['Damaged_Product', 'Missing_Items', 'Quality_Issue', 'Other'];
    if (!validReasons.includes(return_reason)) {
      return NextResponse.json(
        { error: 'סיבת התקלה אינה תקינה. הערכים האפשריים: Damaged_Product, Missing_Items, Quality_Issue, Other' },
        { status: 400 }
      );
    }

    // Validate description length (at least 10 characters)
    if (description.length < 10) {
      return NextResponse.json(
        { error: 'תיאור התקלה חייב להכיל לפחות 10 תווים' },
        { status: 400 }
      );
    }

    // Validate image_urls is an array with 1-5 URLs
    if (!Array.isArray(image_urls)) {
      return NextResponse.json(
        { error: 'רשימת התמונות חייבת להיות מערך' },
        { status: 400 }
      );
    }

    if (image_urls.length < 1) {
      return NextResponse.json(
        { error: 'יש לצרף לפחות תמונה אחת של התקלה' },
        { status: 400 }
      );
    }

    if (image_urls.length > 5) {
      return NextResponse.json(
        { error: 'ניתן לצרף עד 5 תמונות בלבד' },
        { status: 400 }
      );
    }

    // Validate each URL is a string
    for (const url of image_urls) {
      if (typeof url !== 'string' || url.trim() === '') {
        return NextResponse.json(
          { error: 'כל כתובת תמונה חייבת להיות מחרוזת תקינה' },
          { status: 400 }
        );
      }
    }

    // ==========================================
    // DATABASE OPERATIONS
    // ==========================================

    // Check if order exists
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, customer_id, distributor_id, delivery_status')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      console.error('Order lookup error:', orderError);
      return NextResponse.json(
        { error: 'ההזמנה לא נמצאה במערכת' },
        { status: 404 }
      );
    }

    // Validate delivery status is 'Picked_up_by_Customer'
    if (order.delivery_status !== 'Picked_up_by_Customer') {
      return NextResponse.json(
        { error: 'לא ניתן לדווח על תקלה להזמנה זו. ניתן לדווח על תקלות רק להזמנות שנאספו על ידי הלקוח' },
        { status: 403 }
      );
    }

    // Get the customer_id from the order (requested_by field)
    const requestedBy = order.customer_id || order.distributor_id;

    if (!requestedBy) {
      return NextResponse.json(
        { error: 'לא ניתן לזהות את הלקוח של ההזמנה' },
        { status: 400 }
      );
    }

    // Map API return_reason to database enum
    const dbReason = returnReasonMap[return_reason];

    // Create the fault report (return record)
    const { data: returnRecord, error: insertError } = await supabase
      .from('returns')
      .insert({
        order_id: order_id,
        distributor_id: requestedBy, // Using distributor_id as requested_by since that's the schema field
        reason: dbReason,
        description: description,
        image_urls: image_urls,
        quantity_kg: 0, // Will be updated by admin during review
        refund_amount: 0, // Will be calculated by admin during review
        applied_to_balance: false, // Default - admin will decide
        is_approved: false, // Pending status (is_approved = false means pending)
      })
      .select('id, created_at')
      .single();

    if (insertError || !returnRecord) {
      console.error('Failed to create fault report:', insertError);
      return NextResponse.json(
        { error: 'שגיאה ביצירת דיווח התקלה. אנא נסה שנית מאוחר יותר' },
        { status: 500 }
      );
    }

    // ==========================================
    // SUCCESS RESPONSE
    // ==========================================

    return NextResponse.json({
      success: true,
      return: {
        id: returnRecord.id,
        order_number: order.order_number,
        created_at: returnRecord.created_at,
      },
    });

  } catch (error: unknown) {
    console.error('Unexpected error in fault report creation:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `שגיאה לא צפויה: ${errorMessage}` },
      { status: 500 }
    );
  }
}
