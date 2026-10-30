-- ============================================================================
-- SAMARTH SPORTS — PHASE 3: OWNER ADMIN CONTROL CENTER & SHARED GROUND SCHEMA
-- ============================================================================

-- 1. Profiles & Owner Authorization
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'staff' CHECK (role IN ('owner', 'admin', 'staff')),
  is_owner BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ground Settings (Singleton configuration row)
CREATE TABLE IF NOT EXISTS public.ground_settings (
  id INT PRIMARY KEY DEFAULT 1,
  ground_name TEXT DEFAULT 'Samarth Sports Shared Turf',
  cricket_hourly_price NUMERIC(10, 2) NOT NULL DEFAULT 1200.00,
  football_hourly_price NUMERIC(10, 2) NOT NULL DEFAULT 1400.00,
  opening_time TIME NOT NULL DEFAULT '06:00:00',
  closing_time TIME NOT NULL DEFAULT '23:00:00',
  slot_duration_mins INT NOT NULL DEFAULT 60,
  advance_window_days INT NOT NULL DEFAULT 14,
  hold_expiry_mins INT NOT NULL DEFAULT 10,
  owner_email_allowlist TEXT[] DEFAULT ARRAY['guptashivansh724@gmail.com'],
  whatsapp_enabled BOOLEAN DEFAULT false,
  whatsapp_phone_number_id TEXT,
  whatsapp_business_account_id TEXT,
  whatsapp_api_token TEXT,
  notification_preferences JSONB DEFAULT '{"on_confirmed": true, "on_cancelled": true, "on_blocked": true}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT single_settings_row CHECK (id = 1)
);

-- Insert default ground configuration if not present
INSERT INTO public.ground_settings (id, cricket_hourly_price, football_hourly_price)
VALUES (1, 1200.00, 1400.00)
ON CONFLICT (id) DO NOTHING;

-- 3. Bookings (Shared Arena: 1 Physical Pitch for Cricket and Football)
CREATE TABLE IF NOT EXISTS public.bookings (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  sport TEXT NOT NULL CHECK (sport IN ('Cricket', 'Football')),
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  duration_hours NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
  total_amount NUMERIC(10, 2) NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (payment_status IN ('pending', 'successful', 'failed', 'refunded')),
  booking_status TEXT NOT NULL DEFAULT 'pending_payment' 
    CHECK (booking_status IN ('pending_payment', 'confirmed', 'cancelled', 'expired')),
  hold_expires_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for lightning-fast calendar and date lookups
CREATE INDEX IF NOT EXISTS idx_bookings_date_status ON public.bookings(booking_date, booking_status);
CREATE INDEX IF NOT EXISTS idx_bookings_customer_phone ON public.bookings(customer_phone);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON public.bookings(payment_status);

-- 4. Payments (Audited transaction records)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id TEXT NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT UNIQUE,
  razorpay_signature TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT NOT NULL CHECK (status IN ('pending', 'successful', 'failed', 'refunded')),
  payment_method TEXT,
  raw_payload JSONB,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON public.payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment ON public.payments(razorpay_payment_id);

-- 5. Blocked Slots (Owner Manual Ground Lockout for both sports)
CREATE TABLE IF NOT EXISTS public.blocked_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('Maintenance', 'Private match', 'Ground unavailable', 'Personal reservation', 'Other')),
  internal_note TEXT,
  created_by TEXT DEFAULT 'Owner',
  is_active BOOLEAN DEFAULT true,
  unblocked_at TIMESTAMPTZ,
  unblocked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_slots_date_active ON public.blocked_slots(block_date, is_active);

-- 6. Admin Notifications (Real-time dashboard notifications)
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id TEXT REFERENCES public.bookings(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- 'booking_confirmed', 'booking_cancelled', 'slot_blocked', 'payment_failed'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON public.admin_notifications(is_read, created_at DESC);

-- 7. Notification Delivery Logs (WhatsApp & Multi-channel Auditing)
CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'dashboard', 'email')),
  recipient TEXT NOT NULL,
  event_type TEXT NOT NULL,
  booking_id TEXT REFERENCES public.bookings(id) ON DELETE SET NULL,
  template_name TEXT,
  payload JSONB,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
  response_data JSONB,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- CONCURRENCY-SAFE TRANSACTIONAL FUNCTIONS
-- ============================================================================

-- Function: Check whether a requested time interval conflicts with any
-- confirmed booking or active manual block on the single shared arena.
CREATE OR REPLACE FUNCTION public.check_shared_ground_conflict(
  p_date DATE,
  p_start TIME,
  p_end TIME,
  p_exclude_booking_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  has_conflict BOOLEAN,
  conflict_type TEXT,
  conflict_id TEXT,
  conflict_desc TEXT
) AS $$
BEGIN
  -- 1. Check for overlapping Confirmed Bookings (or unexpired Holds)
  RETURN QUERY
  SELECT 
    TRUE as has_conflict,
    'booking'::TEXT as conflict_type,
    b.id as conflict_id,
    ('Booked by ' || b.customer_name || ' (' || b.sport || ') from ' || b.start_time::TEXT || ' to ' || b.end_time::TEXT)::TEXT as conflict_desc
  FROM public.bookings b
  WHERE b.booking_date = p_date
    AND (
      b.booking_status = 'confirmed'
      OR (b.booking_status = 'pending_payment' AND b.hold_expires_at > NOW())
    )
    AND (p_exclude_booking_id IS NULL OR b.id <> p_exclude_booking_id)
    AND (p_start < b.end_time AND p_end > b.start_time)
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  -- 2. Check for overlapping Manual Ground Blocks
  RETURN QUERY
  SELECT 
    TRUE as has_conflict,
    'blocked_slot'::TEXT as conflict_type,
    bs.id::TEXT as conflict_id,
    ('Ground blocked for ' || bs.reason || ' from ' || bs.start_time::TEXT || ' to ' || bs.end_time::TEXT)::TEXT as conflict_desc
  FROM public.blocked_slots bs
  WHERE bs.block_date = p_date
    AND bs.is_active = TRUE
    AND (p_start < bs.end_time AND p_end > bs.start_time)
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  -- 3. No conflict found
  RETURN QUERY
  SELECT FALSE, NULL::TEXT, NULL::TEXT, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Reserve slot atomically with advisory lock on date to prevent race conditions
CREATE OR REPLACE FUNCTION public.reserve_ground_slot(
  p_booking_id TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_customer_email TEXT,
  p_sport TEXT,
  p_booking_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_total_amount NUMERIC,
  p_hold_duration_mins INT DEFAULT 10
)
RETURNS JSONB AS $$
DECLARE
  v_conflict RECORD;
  v_lock_key BIGINT;
  v_hold_expires TIMESTAMPTZ;
BEGIN
  -- Compute advisory lock key from date string hash
  v_lock_key := ('x' || substr(md5(p_booking_date::TEXT), 1, 15))::bit(64)::bigint;
  
  -- Acquire transactional lock on date
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Check conflict
  SELECT * INTO v_conflict FROM public.check_shared_ground_conflict(p_booking_date, p_start_time, p_end_time);
  
  IF v_conflict.has_conflict THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'SLOT_CONFLICT',
      'message', v_conflict.conflict_desc,
      'conflict_type', v_conflict.conflict_type
    );
  END IF;

  v_hold_expires := NOW() + (p_hold_duration_mins || ' minutes')::INTERVAL;

  -- Insert reservation in pending_payment state
  INSERT INTO public.bookings (
    id, customer_name, customer_phone, customer_email, sport,
    booking_date, start_time, end_time, total_amount,
    booking_status, payment_status, hold_expires_at
  ) VALUES (
    p_booking_id, p_customer_name, p_customer_phone, p_customer_email, p_sport,
    p_booking_date, p_start_time, p_end_time, p_total_amount,
    'pending_payment', 'pending', v_hold_expires
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', p_booking_id,
    'hold_expires_at', v_hold_expires
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ground_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Helper to test if current session is an authorized owner
CREATE OR REPLACE FUNCTION public.is_authorized_owner()
RETURNS BOOLEAN AS $$
DECLARE
  v_email TEXT;
  v_allowlist TEXT[];
BEGIN
  v_email := auth.jwt() ->> 'email';
  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT owner_email_allowlist INTO v_allowlist FROM public.ground_settings WHERE id = 1;
  IF v_allowlist IS NOT NULL AND v_email = ANY(v_allowlist) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (is_owner = TRUE OR role = 'owner')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS: Public can view ground availability and pricing
CREATE POLICY "Public read ground settings" ON public.ground_settings
  FOR SELECT TO anon, authenticated
  USING (true);

-- RLS: Only owner can update ground settings
CREATE POLICY "Owner modify ground settings" ON public.ground_settings
  FOR ALL TO authenticated
  USING (public.is_authorized_owner());

-- RLS: Public can view slot statuses (calendar availability)
CREATE POLICY "Public read bookings" ON public.bookings
  FOR SELECT TO anon, authenticated
  USING (true);

-- RLS: Only owner can update/delete bookings
CREATE POLICY "Owner manage bookings" ON public.bookings
  FOR ALL TO authenticated
  USING (public.is_authorized_owner());

-- RLS: Public can view active blocked slots
CREATE POLICY "Public read blocked slots" ON public.blocked_slots
  FOR SELECT TO anon, authenticated
  USING (true);

-- RLS: Only owner can insert/update blocked slots
CREATE POLICY "Owner manage blocked slots" ON public.blocked_slots
  FOR ALL TO authenticated
  USING (public.is_authorized_owner());

-- RLS: Only owner can access payments and notifications
CREATE POLICY "Owner access payments" ON public.payments
  FOR ALL TO authenticated
  USING (public.is_authorized_owner());

CREATE POLICY "Owner access notifications" ON public.admin_notifications
  FOR ALL TO authenticated
  USING (public.is_authorized_owner());

CREATE POLICY "Owner access delivery logs" ON public.notification_delivery_logs
  FOR ALL TO authenticated
  USING (public.is_authorized_owner());

-- Enable Supabase Realtime Publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'bookings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'blocked_slots'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.blocked_slots;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'admin_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_notifications;
  END IF;
END $$;
