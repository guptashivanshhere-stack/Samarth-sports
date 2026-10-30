// /api/webhooks/razorpay.js - Server-side Razorpay Webhook Verification
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const signature = req.headers['x-razorpay-signature'];
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

  // 1. Verify Webhook Signature if secret configured
  if (webhookSecret && signature) {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error('[Razorpay Webhook] Invalid signature match');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
  }

  const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const eventType = event.event;
  const payload = event.payload;

  console.log(`[Razorpay Webhook Received] Event: ${eventType}`);

  try {
    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = payload.payment?.entity;
      const orderId = paymentEntity?.order_id || payload.order?.entity?.id;
      const paymentId = paymentEntity?.id;
      const amount = (paymentEntity?.amount || 0) / 100; // in INR
      const bookingId = paymentEntity?.notes?.booking_id || payload.order?.entity?.notes?.booking_id;

      if (!bookingId) {
        console.warn('[Razorpay Webhook] No booking_id found in payment notes');
        return res.status(200).json({ received: true, note: 'No booking_id mapped' });
      }

      if (supabase) {
        // 2. Deduplication check: Check if payment already processed
        const { data: existingPayment } = await supabase
          .from('payments')
          .select('id')
          .eq('razorpay_payment_id', paymentId)
          .single();

        if (existingPayment) {
          console.log(`[Razorpay Webhook] Payment ${paymentId} already processed (idempotent skip)`);
          return res.status(200).json({ received: true, deduplicated: true });
        }

        // 3. Update Booking to Confirmed & Payment to Successful
        const { data: booking, error: bookingErr } = await supabase
          .from('bookings')
          .update({
            payment_status: 'successful',
            booking_status: 'confirmed',
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId)
          .select()
          .single();

        if (bookingErr) throw bookingErr;

        // 4. Record Payment Transaction
        await supabase.from('payments').insert([{
          booking_id: bookingId,
          razorpay_order_id: orderId,
          razorpay_payment_id: paymentId,
          razorpay_signature: signature || 'webhook_verified',
          amount: amount,
          status: 'successful',
          payment_method: paymentEntity?.method,
          raw_payload: paymentEntity,
          verified_at: new Date().toISOString()
        }]);

        // 5. Create Real-Time Admin Notification
        await supabase.from('admin_notifications').insert([{
          booking_id: bookingId,
          type: 'booking_confirmed',
          title: 'New Booking Confirmed',
          message: `${booking.customer_name} booked ${booking.sport} on ${booking.booking_date} (${booking.start_time} - ${booking.end_time})`,
          data: { booking, paymentId }
        }]);

        // 6. Queue WhatsApp Notification to Owner and Customer
        if (process.env.WHATSAPP_API_TOKEN) {
          // Trigger WhatsApp Cloud API dispatch
          // Will be handled via internal call to /api/notifications/whatsapp
        }
      }

      return res.status(200).json({
        received: true,
        status: 'confirmed',
        booking_id: bookingId,
        payment_id: paymentId
      });
    }

    if (eventType === 'payment.failed') {
      const paymentEntity = payload.payment?.entity;
      const bookingId = paymentEntity?.notes?.booking_id;
      if (bookingId && supabase) {
        await supabase
          .from('bookings')
          .update({
            payment_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', bookingId);
      }
      return res.status(200).json({ received: true, status: 'payment_failed_recorded' });
    }

    return res.status(200).json({ received: true, unhandledEvent: eventType });
  } catch (err) {
    console.error('[Razorpay Webhook Error]', err);
    return res.status(500).json({ error: err.message });
  }
}
