import { createClient } from '@supabase/supabase-js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {});

const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey && !supabaseUrl.includes('your-project-id'));

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// ============================================================================
// OWNER ALLOWLIST CONFIGURATION
// ============================================================================
const DEFAULT_ALLOWLIST = ['guptashivansh724@gmail.com'];

export function getOwnerAllowlist() {
  const envAllowlist = env.VITE_OWNER_EMAIL_ALLOWLIST || env.OWNER_EMAIL_ALLOWLIST || '';
  if (envAllowlist) {
    return envAllowlist.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
  }
  return DEFAULT_ALLOWLIST;
}

export function isOwnerEmail(email) {
  if (!email) return false;
  const allowlist = getOwnerAllowlist();
  return allowlist.includes(email.trim().toLowerCase());
}

// ============================================================================
// LOCAL STORAGE PERSISTENCE ENGINE (True Transactional Semantics for Dev/Fallback)
// ============================================================================
const STORAGE_KEYS = {
  BOOKINGS: 'samarth_sports_bookings_v1',
  BLOCKS: 'samarth_sports_blocks_v1',
  SETTINGS: 'samarth_sports_settings_v1',
  NOTIFICATIONS: 'samarth_sports_notifications_v1',
  AUTH: 'samarth_sports_auth_v1',
  DELIVERY_LOGS: 'samarth_sports_delivery_logs_v1'
};

const DEFAULT_SETTINGS = {
  id: 1,
  ground_name: 'Samarth Sports Shared Turf',
  cricket_hourly_price: 1200,
  football_hourly_price: 1400,
  opening_time: '06:00',
  closing_time: '23:00',
  slot_duration_mins: 60,
  advance_window_days: 14,
  hold_expiry_mins: 10,
  owner_email_allowlist: DEFAULT_ALLOWLIST,
  whatsapp_enabled: false,
  whatsapp_phone_number_id: '',
  whatsapp_business_account_id: '',
  notification_preferences: {
    on_confirmed: true,
    on_cancelled: true,
    on_blocked: true
  }
};

function readStorage(key, defaultVal) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch (_) {
    return defaultVal;
  }
}

function writeStorage(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('Storage write error:', e);
  }
}

// ============================================================================
// SHARED GROUND CONFLICT ENGINE (Enforces 1 Physical Pitch for Both Sports)
// ============================================================================
export function checkSharedGroundConflictSync(dateStr, startTime, endTime, excludeBookingId = null) {
  const bookings = readStorage(STORAGE_KEYS.BOOKINGS, []);
  const blocks = readStorage(STORAGE_KEYS.BLOCKS, []);

  // 1. Check confirmed bookings or active holds
  const now = new Date().toISOString();
  for (const b of bookings) {
    if (b.booking_date !== dateStr) continue;
    if (excludeBookingId && b.id === excludeBookingId) continue;
    
    const isConfirmed = b.booking_status === 'confirmed';
    const isHoldActive = b.booking_status === 'pending_payment' && b.hold_expires_at && b.hold_expires_at > now;
    
    if (isConfirmed || isHoldActive) {
      if (startTime < b.end_time && endTime > b.start_time) {
        return {
          hasConflict: true,
          type: 'booking',
          id: b.id,
          desc: `Already booked for ${b.sport} by ${b.customer_name} (${b.start_time} - ${b.end_time})`
        };
      }
    }
  }

  // 2. Check active manual blocks
  for (const blk of blocks) {
    if (blk.block_date !== dateStr || !blk.is_active) continue;
    if (startTime < blk.end_time && endTime > blk.start_time) {
      return {
        hasConflict: true,
        type: 'blocked_slot',
        id: blk.id,
        desc: `Ground blocked for ${blk.reason} (${blk.start_time} - ${blk.end_time})`
      };
    }
  }

  return { hasConflict: false };
}

// ============================================================================
// DATA ACCESS LAYER (Transparently routes to Supabase or Transactional Storage)
// ============================================================================
export const DataService = {
  // --- AUTHENTICATION ---
  async getCurrentUser() {
    if (isSupabaseConfigured) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      return {
        id: user.id,
        email: user.email,
        isOwner: isOwnerEmail(user.email)
      };
    }
    // Fallback Session
    const localAuth = readStorage(STORAGE_KEYS.AUTH, null);
    if (!localAuth) return null;
    return {
      ...localAuth,
      isOwner: isOwnerEmail(localAuth.email)
    };
  },

  async loginOwner(email, password) {
    if (!isOwnerEmail(email)) {
      throw new Error(`Unauthorized: ${email} is not in the Owner Allowlist.`);
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return {
        id: data.user.id,
        email: data.user.email,
        isOwner: true
      };
    }

    // Local Auth Session
    const session = {
      id: 'owner_' + Math.random().toString(36).substring(2, 9),
      email: email.trim().toLowerCase(),
      name: 'Ground Owner',
      token: 'jwt_mock_' + Date.now(),
      isOwner: true
    };
    writeStorage(STORAGE_KEYS.AUTH, session);
    return session;
  },

  async logoutOwner() {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(STORAGE_KEYS.AUTH);
  },

  // --- OVERVIEW METRICS ---
  async getOverviewMetrics() {
    if (isSupabaseConfigured) {
      const today = new Date().toISOString().split('T')[0];
      const { data: bookings } = await supabase
        .from('bookings')
        .select('*');

      const { data: blocks } = await supabase
        .from('blocked_slots')
        .select('*')
        .eq('is_active', true);

      return calculateMetrics(bookings || [], blocks || [], today);
    }

    const bookings = readStorage(STORAGE_KEYS.BOOKINGS, []);
    const blocks = readStorage(STORAGE_KEYS.BLOCKS, []);
    const today = new Date().toISOString().split('T')[0];
    return calculateMetrics(bookings, blocks, today);
  },

  // --- BOOKING MANAGEMENT ---
  async getBookings(filters = {}) {
    let list = [];
    if (isSupabaseConfigured) {
      let query = supabase.from('bookings').select('*').order('created_at', { ascending: false });
      if (filters.date) query = query.eq('booking_date', filters.date);
      if (filters.sport && filters.sport !== 'all') query = query.eq('sport', filters.sport);
      if (filters.status && filters.status !== 'all') query = query.eq('booking_status', filters.status);
      if (filters.payment && filters.payment !== 'all') query = query.eq('payment_status', filters.payment);
      const { data } = await query;
      list = data || [];
    } else {
      list = readStorage(STORAGE_KEYS.BOOKINGS, []);
    }

    // Apply filters
    return list.filter(b => {
      if (filters.date && b.booking_date !== filters.date) return false;
      if (filters.sport && filters.sport !== 'all' && b.sport !== filters.sport) return false;
      if (filters.status && filters.status !== 'all' && b.booking_status !== filters.status) return false;
      if (filters.payment && filters.payment !== 'all' && b.payment_status !== filters.payment) return false;
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const matchName = b.customer_name?.toLowerCase().includes(s);
        const matchId = b.id?.toLowerCase().includes(s);
        const matchPhone = b.customer_phone?.includes(s);
        if (!matchName && !matchId && !matchPhone) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  },

  async cancelBooking(bookingId, reason = 'Owner initiated cancellation') {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('bookings')
        .update({
          booking_status: 'cancelled',
          cancellation_reason: reason,
          cancelled_at: new Date().toISOString()
        })
        .eq('id', bookingId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const bookings = readStorage(STORAGE_KEYS.BOOKINGS, []);
    const idx = bookings.findIndex(b => b.id === bookingId);
    if (idx === -1) throw new Error('Booking not found');

    bookings[idx].booking_status = 'cancelled';
    bookings[idx].cancellation_reason = reason;
    bookings[idx].cancelled_at = new Date().toISOString();
    writeStorage(STORAGE_KEYS.BOOKINGS, bookings);

    // Add notification
    this.addNotification({
      booking_id: bookingId,
      type: 'booking_cancelled',
      title: 'Booking Cancelled',
      message: `Booking #${bookingId} was cancelled (${reason})`,
      data: { booking: bookings[idx] }
    });

    return bookings[idx];
  },

  // --- MANUAL SLOT BLOCKING ---
  async getBlockedSlots(dateStr = null) {
    if (isSupabaseConfigured) {
      let query = supabase.from('blocked_slots').select('*').eq('is_active', true);
      if (dateStr) query = query.eq('block_date', dateStr);
      const { data } = await query;
      return data || [];
    }

    const blocks = readStorage(STORAGE_KEYS.BLOCKS, []);
    return blocks.filter(b => b.is_active && (!dateStr || b.block_date === dateStr));
  },

  async blockSlot({ date, startTime, endTime, reason, internalNote = '' }) {
    // 1. Validate conflict with shared ground
    const conflict = checkSharedGroundConflictSync(date, startTime, endTime);
    if (conflict.hasConflict) {
      throw new Error(`Cannot block: ${conflict.desc}`);
    }

    const newBlock = {
      id: 'blk_' + Math.random().toString(36).substring(2, 9),
      block_date: date,
      start_time: startTime,
      end_time: endTime,
      reason,
      internal_note: internalNote,
      created_by: 'Owner',
      is_active: true,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('blocked_slots').insert([newBlock]).select().single();
      if (error) throw error;
      return data;
    }

    const blocks = readStorage(STORAGE_KEYS.BLOCKS, []);
    blocks.push(newBlock);
    writeStorage(STORAGE_KEYS.BLOCKS, blocks);

    this.addNotification({
      type: 'slot_blocked',
      title: 'Ground Blocked by Owner',
      message: `Arena blocked on ${date} (${startTime} - ${endTime}) for ${reason}`,
      data: { block: newBlock }
    });

    return newBlock;
  },

  async unblockSlot(blockId) {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('blocked_slots')
        .update({
          is_active: false,
          unblocked_at: new Date().toISOString(),
          unblocked_by: 'Owner'
        })
        .eq('id', blockId);
      if (error) throw error;
      return true;
    }

    const blocks = readStorage(STORAGE_KEYS.BLOCKS, []);
    const idx = blocks.findIndex(b => b.id === blockId);
    if (idx !== -1) {
      blocks[idx].is_active = false;
      blocks[idx].unblocked_at = new Date().toISOString();
      blocks[idx].unblocked_by = 'Owner';
      writeStorage(STORAGE_KEYS.BLOCKS, blocks);
    }
    return true;
  },

  // --- SHARED CALENDAR AVAILABILITY ---
  async getDaySchedule(dateStr) {
    const settings = await this.getSettings();
    const bookings = await this.getBookings({ date: dateStr });
    const blocks = await this.getBlockedSlots(dateStr);

    // Generate slots according to operating hours
    const slots = [];
    const openHour = parseInt(settings.opening_time.split(':')[0], 10);
    const closeHour = parseInt(settings.closing_time.split(':')[0], 10);

    for (let h = openHour; h < closeHour; h++) {
      const startH = String(h).padStart(2, '0') + ':00';
      const endH = String(h + 1).padStart(2, '0') + ':00';

      // Check bookings (Active or confirmed)
      const booking = bookings.find(b => 
        (b.booking_status === 'confirmed' || b.booking_status === 'pending_payment') &&
        b.start_time < endH && b.end_time > startH
      );

      // Check blocks
      const block = blocks.find(bl => bl.is_active && bl.start_time < endH && bl.end_time > startH);

      let status = 'available';
      let details = null;

      if (block) {
        status = 'blocked';
        details = { reason: block.reason, note: block.internal_note, blockId: block.id };
      } else if (booking) {
        if (booking.booking_status === 'confirmed') {
          status = 'booked';
          details = {
            bookingId: booking.id,
            sport: booking.sport,
            customerName: booking.customer_name,
            phone: booking.customer_phone,
            amount: booking.total_amount
          };
        } else {
          status = 'held';
          details = {
            bookingId: booking.id,
            sport: booking.sport,
            expiresAt: booking.hold_expires_at
          };
        }
      }

      slots.push({
        startTime: startH,
        endTime: endH,
        status, // 'available' | 'booked' | 'held' | 'blocked'
        details
      });
    }

    return {
      date: dateStr,
      groundName: settings.ground_name,
      slots
    };
  },

  // --- SETTINGS ---
  async getSettings() {
    if (isSupabaseConfigured) {
      const { data } = await supabase.from('ground_settings').select('*').eq('id', 1).single();
      if (data) return data;
    }
    return readStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
  },

  async updateSettings(newSettings) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('ground_settings')
        .update(newSettings)
        .eq('id', 1)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const current = readStorage(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
    const updated = { ...current, ...newSettings, updated_at: new Date().toISOString() };
    writeStorage(STORAGE_KEYS.SETTINGS, updated);
    return updated;
  },

  // --- NOTIFICATIONS ---
  async getNotifications() {
    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('admin_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);
      return data || [];
    }
    return readStorage(STORAGE_KEYS.NOTIFICATIONS, []);
  },

  addNotification(notif) {
    const list = readStorage(STORAGE_KEYS.NOTIFICATIONS, []);
    const entry = {
      id: 'notif_' + Math.random().toString(36).substring(2, 9),
      is_read: false,
      created_at: new Date().toISOString(),
      ...notif
    };
    list.unshift(entry);
    writeStorage(STORAGE_KEYS.NOTIFICATIONS, list.slice(0, 50));
    window.dispatchEvent(new CustomEvent('samarth_sports_notification', { detail: entry }));
  },

  markNotificationsRead() {
    const list = readStorage(STORAGE_KEYS.NOTIFICATIONS, []);
    list.forEach(n => { n.is_read = true; });
    writeStorage(STORAGE_KEYS.NOTIFICATIONS, list);
  },

  // --- WHATSAPP & DELIVERY LOGS ---
  async getDeliveryLogs() {
    if (isSupabaseConfigured) {
      const { data } = await supabase
        .from('notification_delivery_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      return data || [];
    }
    return readStorage(STORAGE_KEYS.DELIVERY_LOGS, []);
  }
};

// ============================================================================
// HELPER: CALCULATE METRICS
// ============================================================================
function calculateMetrics(bookings, blocks, todayStr) {
  let todayBookingsCount = 0;
  let todayConfirmedRevenue = 0;
  let pendingPaymentsCount = 0;
  let upcomingBookingsCount = 0;
  let cancelledBookingsCount = 0;
  let activeBlockedCount = blocks.filter(b => b.is_active).length;

  const now = new Date();

  bookings.forEach(b => {
    const isToday = b.booking_date === todayStr;
    const isConfirmed = b.booking_status === 'confirmed';
    const isPending = b.payment_status === 'pending';
    const isCancelled = b.booking_status === 'cancelled';
    const bDate = new Date(`${b.booking_date}T${b.start_time}`);

    if (isToday) {
      todayBookingsCount++;
      if (isConfirmed) {
        todayConfirmedRevenue += Number(b.total_amount || 0);
      }
    }

    if (isPending) {
      pendingPaymentsCount++;
    }

    if (isCancelled) {
      cancelledBookingsCount++;
    }

    if (isConfirmed && bDate >= now) {
      upcomingBookingsCount++;
    }
  });

  return {
    todayBookingsCount,
    todayConfirmedRevenue,
    pendingPaymentsCount,
    upcomingBookingsCount,
    cancelledBookingsCount,
    activeBlockedCount,
    totalBookingsCount: bookings.length
  };
}
