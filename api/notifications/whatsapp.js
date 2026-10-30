// /api/notifications/whatsapp.js - Official Meta WhatsApp Business Platform Integration
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = (supabaseUrl && supabaseServiceKey)
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const ownerNotifyNumber = process.env.WHATSAPP_OWNER_NOTIFY_NUMBER;

  // GET: Check integration status
  if (req.method === 'GET') {
    const isConfigured = Boolean(token && phoneNumberId && !token.includes('your_'));
    return res.status(200).json({
      channel: 'WhatsApp Business Cloud API (Official Meta)',
      configured: isConfigured,
      phoneNumberIdConfigured: Boolean(phoneNumberId),
      ownerNumberConfigured: Boolean(ownerNotifyNumber),
      status: isConfigured ? 'CONNECTED' : 'CREDENTIALS_REQUIRED',
      message: isConfigured
        ? 'Meta WhatsApp Cloud API is authenticated and ready for live template delivery.'
        : 'WhatsApp API credentials (WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID) are not configured. Integration architecture is active and will transmit once credentials are provided.'
    });
  }

  if (req.method === 'POST') {
    const { eventType, booking, recipient } = req.body || {};

    if (!booking) {
      return res.status(400).json({ error: 'Missing booking payload' });
    }

    const targetRecipient = recipient || ownerNotifyNumber;

    // Check if live credentials exist
    if (!token || !phoneNumberId || token.includes('your_')) {
      const logEntry = {
        channel: 'whatsapp',
        recipient: targetRecipient || 'NOT_CONFIGURED',
        event_type: eventType || 'booking_confirmed',
        booking_id: booking.id,
        template_name: 'samarth_sports_booking_alert',
        status: 'failed',
        error_message: 'WHATSAPP_CREDENTIALS_MISSING: Live Meta WhatsApp Cloud API credentials not configured in environment variables.',
        created_at: new Date().toISOString()
      };

      if (supabase) {
        await supabase.from('notification_delivery_logs').insert([logEntry]);
      }

      return res.status(200).json({
        delivered: false,
        status: 'FAILED_NO_CREDENTIALS',
        reason: 'WhatsApp API credentials are missing. Live delivery cannot be dispatched. Recorded in delivery logs.',
        log: logEntry
      });
    }

    // Format WhatsApp Cloud API Template Payload
    const formattedMessage = 
`*SAMARTH SPORTS*
*NEW BOOKING CONFIRMED*

*Customer:* ${booking.customer_name}
*Sport:* ${booking.sport}
*Date:* ${booking.booking_date}
*Time:* ${booking.start_time} - ${booking.end_time}
*Payment:* ${booking.payment_status === 'successful' ? 'Successful' : booking.payment_status}
*Booking ID:* ${booking.id}`;

    try {
      const metaUrl = `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`;
      const metaResponse = await fetch(metaUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: targetRecipient.replace(/\D/g, ''),
          type: 'text',
          text: {
            preview_url: false,
            body: formattedMessage
          }
        })
      });

      const responseData = await metaResponse.json();

      if (!metaResponse.ok) {
        throw new Error(responseData?.error?.message || 'Meta API returned an error');
      }

      const logEntry = {
        channel: 'whatsapp',
        recipient: targetRecipient,
        event_type: eventType || 'booking_confirmed',
        booking_id: booking.id,
        template_name: 'samarth_sports_booking_alert',
        status: 'delivered',
        response_data: responseData,
        created_at: new Date().toISOString()
      };

      if (supabase) {
        await supabase.from('notification_delivery_logs').insert([logEntry]);
      }

      return res.status(200).json({
        delivered: true,
        status: 'SENT',
        messageId: responseData?.messages?.[0]?.id,
        recipient: targetRecipient
      });
    } catch (apiError) {
      console.error('[WhatsApp Cloud API Error]', apiError);

      const logEntry = {
        channel: 'whatsapp',
        recipient: targetRecipient,
        event_type: eventType || 'booking_confirmed',
        booking_id: booking.id,
        status: 'failed',
        error_message: apiError.message,
        created_at: new Date().toISOString()
      };

      if (supabase) {
        await supabase.from('notification_delivery_logs').insert([logEntry]);
      }

      return res.status(502).json({
        delivered: false,
        status: 'FAILED',
        error: apiError.message
      });
    }
  }

  return res.status(405).json({ error: 'Method Not Allowed' });
}
