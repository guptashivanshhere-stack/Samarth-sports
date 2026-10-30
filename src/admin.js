// ============================================================================
// SAMARTH SPORTS — OWNER CONTROL CENTER APPLICATION (PHASE 3)
// ============================================================================
import { DataService, isOwnerEmail, checkSharedGroundConflictSync, supabase, isSupabaseConfigured } from './supabase.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const authGateOverlay = document.getElementById('authGateOverlay');
  const adminAppLayout = document.getElementById('adminAppLayout');
  const mobileBottomDock = document.getElementById('mobileBottomDock');
  const ownerLoginForm = document.getElementById('ownerLoginForm');
  const ownerEmailInput = document.getElementById('ownerEmailInput');
  const ownerPasswordInput = document.getElementById('ownerPasswordInput');
  const authErrorBanner = document.getElementById('authErrorBanner');
  const btnSidebarLogout = document.getElementById('btnSidebarLogout');
  const sidebarOwnerEmail = document.getElementById('sidebarOwnerEmail');
  const sidebarAvatar = document.getElementById('sidebarAvatar');
  const topbarSectionTitle = document.getElementById('topbarSectionTitle');
  const btnMobileMenuToggle = document.getElementById('btnMobileMenuToggle');
  const adminSidebar = document.getElementById('adminSidebar');

  // Modals
  const modalBlockSlot = document.getElementById('modalBlockSlot');
  const btnOpenBlockModal = document.getElementById('btnOpenBlockModal');
  const btnQuickBlockModal = document.getElementById('btnQuickBlockModal');
  const btnCloseBlockModal = document.getElementById('btnCloseBlockModal');
  const btnCancelBlockModal = document.getElementById('btnCancelBlockModal');
  const formManualBlock = document.getElementById('formManualBlock');
  const blockErrorBanner = document.getElementById('blockErrorBanner');

  const modalBookingDetails = document.getElementById('modalBookingDetails');
  const btnCloseBookingDetails = document.getElementById('btnCloseBookingDetails');
  const btnCloseDetailsBottom = document.getElementById('btnCloseDetailsBottom');
  const bookingDetailsContent = document.getElementById('bookingDetailsContent');
  const detailBookingIdPill = document.getElementById('detailBookingIdPill');
  const btnTriggerCancelBooking = document.getElementById('btnTriggerCancelBooking');

  // Calendar
  const calendarDatePicker = document.getElementById('calendarDatePicker');
  const btnCalPrev = document.getElementById('btnCalPrev');
  const btnCalToday = document.getElementById('btnCalToday');
  const btnCalNext = document.getElementById('btnCalNext');
  const calendarSlotsList = document.getElementById('calendarSlotsList');
  const calBannerDateText = document.getElementById('calBannerDateText');
  const btnGoToCalendar = document.getElementById('btnGoToCalendar');

  // Bookings Filter Elements
  const bookingSearchInput = document.getElementById('bookingSearchInput');
  const filterDate = document.getElementById('filterDate');
  const filterSport = document.getElementById('filterSport');
  const filterStatus = document.getElementById('filterStatus');
  const filterPayment = document.getElementById('filterPayment');
  const btnResetFilters = document.getElementById('btnResetFilters');
  const bookingsTableBody = document.getElementById('bookingsTableBody');
  const emptyBookingsPlaceholder = document.getElementById('emptyBookingsPlaceholder');

  // Settings Elements
  const groundSettingsForm = document.getElementById('groundSettingsForm');
  const cfgCricketPrice = document.getElementById('cfgCricketPrice');
  const cfgFootballPrice = document.getElementById('cfgFootballPrice');
  const cfgOpenTime = document.getElementById('cfgOpenTime');
  const cfgCloseTime = document.getElementById('cfgCloseTime');
  const cfgSlotDuration = document.getElementById('cfgSlotDuration');
  const cfgAdvanceWindow = document.getElementById('cfgAdvanceWindow');
  const cfgHoldExpiry = document.getElementById('cfgHoldExpiry');
  const cfgAllowlist = document.getElementById('cfgAllowlist');
  const cfgWaPhoneId = document.getElementById('cfgWaPhoneId');
  const cfgWaAccount = document.getElementById('cfgWaAccount');
  const settingsSaveStatus = document.getElementById('settingsSaveStatus');

  // Notifications
  const btnTopbarBell = document.getElementById('btnTopbarBell');
  const bellAlertPip = document.getElementById('bellAlertPip');
  const notificationsFeedList = document.getElementById('notificationsFeedList');
  const deliveryLogsList = document.getElementById('deliveryLogsList');
  const btnMarkAllRead = document.getElementById('btnMarkAllRead');

  let activeBookingForDetails = null;
  let currentCalendarDate = new Date().toISOString().split('T')[0];

  // =========================================================================
  // 0. AUDIO CHIME & HAPTIC SYNTHESIZER (Apple WWDC Audio-Haptic Guidelines)
  // =========================================================================
  function playAppleNotificationChime() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      // Elegant Apple-style ascending major chord
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5

      osc2.frequency.setValueAtTime(880, ctx.currentTime);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, ctx.currentTime + 0.16); // D6

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.45);
      osc2.stop(ctx.currentTime + 0.45);
    } catch (_) {
      // Audio autoplay policy fallback
    }
  }

  function triggerHaptic(type = 'light') {
    try {
      if ('vibrate' in navigator) {
        if (type === 'light') navigator.vibrate(8);
        else if (type === 'medium') navigator.vibrate(16);
        else if (type === 'warning') navigator.vibrate([15, 30, 15]);
      }
    } catch (_) {}
  }

  // =========================================================================
  // 1. OWNER AUTHENTICATION GATE
  // =========================================================================
  async function checkAuthSession() {
    try {
      const user = await DataService.getCurrentUser();
      if (user && user.isOwner) {
        showAdminApp(user);
      } else {
        showAuthGate();
      }
    } catch (e) {
      showAuthGate();
    }
  }

  function showAuthGate() {
    authGateOverlay.style.display = 'flex';
    adminAppLayout.style.display = 'none';
    mobileBottomDock.style.display = 'none';
  }

  function showAdminApp(user) {
    authGateOverlay.style.display = 'none';
    adminAppLayout.style.display = 'flex';
    if (window.innerWidth <= 768) {
      mobileBottomDock.style.display = 'flex';
    }

    sidebarOwnerEmail.innerText = user.email;
    sidebarAvatar.innerText = user.email.charAt(0).toUpperCase();

    // Initial load
    refreshOverviewMetrics();
    loadBookingsTable();
    loadSharedCalendar(currentCalendarDate);
    loadBlockedSlotsTable();
    loadNotifications();
    loadSettingsIntoForm();
  }

  ownerLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic('medium');
    authErrorBanner.style.display = 'none';

    const email = ownerEmailInput.value.trim().toLowerCase();
    const password = ownerPasswordInput.value;

    try {
      const user = await DataService.loginOwner(email, password);
      showAdminApp(user);
    } catch (err) {
      triggerHaptic('warning');
      authErrorBanner.innerText = err.message || 'Authentication failed. Please verify credentials.';
      authErrorBanner.style.display = 'block';
    }
  });

  btnSidebarLogout.addEventListener('click', async () => {
    triggerHaptic('light');
    if (confirm('Lock Owner Control Center and log out?')) {
      await DataService.logoutOwner();
      showAuthGate();
    }
  });

  // =========================================================================
  // 2. TAB NAVIGATION (Desktop Sidebar + Mobile Bottom Dock)
  // =========================================================================
  const tabTitles = {
    overview: 'Overview',
    bookings: 'Booking Management',
    calendar: 'Shared Ground Calendar',
    blocks: 'Manual Ground Blocks',
    notifications: 'Live Alerts & Audit Logs',
    settings: 'Ground Settings'
  };

  function switchTab(tabKey) {
    triggerHaptic('light');

    // Update sidebar buttons
    document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabKey);
    });

    // Update mobile dock buttons
    document.querySelectorAll('.dock-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabKey);
    });

    // Update view panels
    document.querySelectorAll('.admin-view').forEach(view => {
      view.classList.toggle('active', view.id === `view-${tabKey}`);
    });

    // Update Topbar
    topbarSectionTitle.innerText = tabTitles[tabKey] || 'Control Center';

    // Close mobile sidebar if open
    adminSidebar.classList.remove('open');

    // Auto-refresh relevant data
    if (tabKey === 'overview') refreshOverviewMetrics();
    if (tabKey === 'bookings') loadBookingsTable();
    if (tabKey === 'calendar') loadSharedCalendar(currentCalendarDate);
    if (tabKey === 'blocks') loadBlockedSlotsTable();
    if (tabKey === 'notifications') {
      loadNotifications();
      DataService.markNotificationsRead();
      bellAlertPip.style.display = 'none';
    }
    if (tabKey === 'settings') loadSettingsIntoForm();
  }

  document.querySelectorAll('.sidebar-nav-item, .dock-item').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  btnGoToCalendar?.addEventListener('click', () => switchTab('calendar'));

  // Mobile menu toggle
  btnMobileMenuToggle?.addEventListener('click', () => {
    adminSidebar.classList.toggle('open');
    triggerHaptic('light');
  });

  // =========================================================================
  // 3. OVERVIEW DASHBOARD METRICS (Real Database Records)
  // =========================================================================
  async function refreshOverviewMetrics() {
    try {
      const metrics = await DataService.getOverviewMetrics();
      document.getElementById('metricTodayBookings').innerText = metrics.todayBookingsCount;
      document.getElementById('metricTodayRevenue').innerText = metrics.todayConfirmedRevenue.toLocaleString('en-IN');
      document.getElementById('metricPendingPayments').innerText = metrics.pendingPaymentsCount;
      document.getElementById('metricUpcomingBookings').innerText = metrics.upcomingBookingsCount;
      document.getElementById('metricActiveBlocked').innerText = metrics.activeBlockedCount;
      document.getElementById('metricCancelledBookings').innerText = metrics.cancelledBookingsCount;

      // Update counters in sidebar
      document.getElementById('sidebarBookingCount').innerText = metrics.totalBookingsCount;
      document.getElementById('sidebarBlockCount').innerText = metrics.activeBlockedCount;

      // Load today's timeline in overview
      const todayStr = new Date().toISOString().split('T')[0];
      const dayData = await DataService.getDaySchedule(todayStr);
      renderOverviewTimeline(dayData.slots);
    } catch (err) {
      console.error('Failed to refresh metrics:', err);
    }
  }

  function renderOverviewTimeline(slots) {
    const container = document.getElementById('todayOverviewTimeline');
    if (!container) return;
    container.innerHTML = '';

    // Show upcoming or recent 6 slots for compact overview
    const relevantSlots = slots.slice(0, 7);

    relevantSlots.forEach(slot => {
      const row = document.createElement('div');
      row.className = 'timeline-slot-row';

      let pillClass = 'available';
      let pillText = 'AVAILABLE';

      if (slot.status === 'booked') {
        pillClass = slot.details.sport === 'Cricket' ? 'booked-cricket' : 'booked-football';
        pillText = `${slot.details.sport} &bull; ${slot.details.customerName}`;
      } else if (slot.status === 'held') {
        pillClass = 'held';
        pillText = 'HELD (PAYMENT)';
      } else if (slot.status === 'blocked') {
        pillClass = 'blocked';
        pillText = `BLOCKED (${slot.details.reason})`;
      }

      row.innerHTML = `
        <div class="slot-time-col">
          <span class="slot-time-bold">${slot.startTime} - ${slot.endTime}</span>
        </div>
        <span class="slot-status-pill ${pillClass}">${pillText}</span>
      `;

      container.appendChild(row);
    });
  }

  // =========================================================================
  // 4. BOOKING MANAGEMENT (Search, Filters, Audited Cancel)
  // =========================================================================
  async function loadBookingsTable() {
    const filters = {
      search: bookingSearchInput.value.trim(),
      date: filterDate.value,
      sport: filterSport.value,
      status: filterStatus.value,
      payment: filterPayment.value
    };

    try {
      const bookings = await DataService.getBookings(filters);
      bookingsTableBody.innerHTML = '';

      if (bookings.length === 0) {
        emptyBookingsPlaceholder.style.display = 'flex';
        return;
      }
      emptyBookingsPlaceholder.style.display = 'none';

      bookings.forEach(b => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="booking-id-tag">${b.id}</span></td>
          <td>
            <div class="customer-cell">
              <span class="customer-name">${b.customer_name}</span>
              <span class="customer-phone">${b.customer_phone}</span>
            </div>
          </td>
          <td><span class="sport-badge">${b.sport}</span></td>
          <td>
            <div>${b.booking_date}</div>
            <div style="font-size: 0.74rem; color: var(--color-accent-secondary);">${b.start_time} - ${b.end_time}</div>
          </td>
          <td style="font-weight: 700; color: #FFFFFF;">₹${Number(b.total_amount).toLocaleString('en-IN')}</td>
          <td><span class="status-pill ${b.payment_status}">${b.payment_status.toUpperCase()}</span></td>
          <td><span class="status-pill ${b.booking_status}">${b.booking_status.replace('_', ' ').toUpperCase()}</span></td>
          <td>
            <button type="button" class="btn-table-action" data-action="view" data-id="${b.id}">Details</button>
          </td>
        `;

        tr.querySelector('[data-action="view"]').addEventListener('click', () => {
          openBookingDetailsModal(b);
        });

        bookingsTableBody.appendChild(tr);
      });
    } catch (err) {
      console.error('Failed to load bookings:', err);
    }
  }

  // Hook filters
  [bookingSearchInput, filterDate, filterSport, filterStatus, filterPayment].forEach(el => {
    el.addEventListener('input', () => loadBookingsTable());
    el.addEventListener('change', () => loadBookingsTable());
  });

  btnResetFilters.addEventListener('click', () => {
    bookingSearchInput.value = '';
    filterDate.value = '';
    filterSport.value = 'all';
    filterStatus.value = 'all';
    filterPayment.value = 'all';
    loadBookingsTable();
  });

  // Booking details modal
  function openBookingDetailsModal(booking) {
    triggerHaptic('light');
    activeBookingForDetails = booking;
    detailBookingIdPill.innerText = booking.id;

    bookingDetailsContent.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
        <div>
          <span class="form-label">CUSTOMER NAME</span>
          <p style="font-size: 1rem; font-weight: 700; color: #FFFFFF;">${booking.customer_name}</p>
        </div>
        <div>
          <span class="form-label">PHONE NUMBER</span>
          <p style="font-size: 0.95rem; color: #FFFFFF;">${booking.customer_phone}</p>
        </div>
        <div>
          <span class="form-label">EMAIL ADDRESS</span>
          <p style="font-size: 0.88rem; color: var(--color-text-primary);">${booking.customer_email || 'Not provided'}</p>
        </div>
        <div>
          <span class="form-label">SPORT</span>
          <p style="font-size: 0.95rem; font-weight: 700; color: #FFFFFF;">${booking.sport}</p>
        </div>
        <div>
          <span class="form-label">RESERVATION DATE</span>
          <p style="font-size: 0.95rem; color: #FFFFFF;">${booking.booking_date}</p>
        </div>
        <div>
          <span class="form-label">TIME SLOT</span>
          <p style="font-size: 0.95rem; font-weight: 700; color: var(--color-accent-secondary);">${booking.start_time} - ${booking.end_time} (${booking.duration_hours || 1} hr)</p>
        </div>
        <div>
          <span class="form-label">TOTAL AMOUNT</span>
          <p style="font-size: 1.15rem; font-weight: 800; color: #10B981;">₹${Number(booking.total_amount).toLocaleString('en-IN')}</p>
        </div>
        <div>
          <span class="form-label">PAYMENT STATUS</span>
          <span class="status-pill ${booking.payment_status}">${booking.payment_status.toUpperCase()}</span>
        </div>
      </div>

      <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--color-border-subtle);">
        <span class="form-label">BOOKING STATUS</span>
        <div style="margin-top: 0.35rem;">
          <span class="status-pill ${booking.booking_status}">${booking.booking_status.replace('_', ' ').toUpperCase()}</span>
        </div>
        ${booking.cancellation_reason ? `
          <div style="margin-top: 0.5rem; background: rgba(239, 68, 68, 0.15); padding: 0.65rem; border-radius: 8px; color: #FCA5A5; font-size: 0.78rem;">
            <strong>Cancellation Reason:</strong> ${booking.cancellation_reason}
          </div>
        ` : ''}
      </div>
    `;

    // Only show cancel action if not already cancelled
    if (booking.booking_status === 'cancelled') {
      btnTriggerCancelBooking.style.display = 'none';
    } else {
      btnTriggerCancelBooking.style.display = 'block';
    }

    modalBookingDetails.classList.add('open');
    modalBookingDetails.setAttribute('aria-hidden', 'false');
  }

  function closeBookingDetailsModal() {
    modalBookingDetails.classList.remove('open');
    modalBookingDetails.setAttribute('aria-hidden', 'true');
    activeBookingForDetails = null;
  }

  [btnCloseBookingDetails, btnCloseDetailsBottom].forEach(b => b.addEventListener('click', closeBookingDetailsModal));

  btnTriggerCancelBooking.addEventListener('click', async () => {
    if (!activeBookingForDetails) return;
    const reason = prompt('Enter mandatory cancellation reason for audit log:', 'Owner requested cancellation');
    if (!reason) return;

    try {
      await DataService.cancelBooking(activeBookingForDetails.id, reason);
      triggerHaptic('warning');
      alert(`Booking ${activeBookingForDetails.id} has been cancelled.`);
      closeBookingDetailsModal();
      loadBookingsTable();
      refreshOverviewMetrics();
      loadSharedCalendar(currentCalendarDate);
    } catch (e) {
      alert('Cancellation failed: ' + e.message);
    }
  });

  // =========================================================================
  // 5. SHARED GROUND AVAILABILITY CALENDAR (1 Common Arena for Both Sports)
  // =========================================================================
  calendarDatePicker.value = currentCalendarDate;

  async function loadSharedCalendar(dateStr) {
    try {
      calBannerDateText.innerText = `Schedule for ${dateStr}`;
      const dayData = await DataService.getDaySchedule(dateStr);
      calendarSlotsList.innerHTML = '';

      dayData.slots.forEach(slot => {
        const row = document.createElement('div');
        row.className = 'cal-slot-row';

        let cardClass = 'available';
        let cardContent = `
          <span>Ground Available for Booking</span>
          <button type="button" class="btn-table-action" data-time="${slot.startTime}-${slot.endTime}">Block Slot</button>
        `;

        if (slot.status === 'booked') {
          cardClass = 'booked';
          cardContent = `
            <div>
              <strong>${slot.details.sport.toUpperCase()} RESERVED</strong> &bull; ${slot.details.customerName} (${slot.details.phone})
            </div>
            <span class="booking-id-tag">#${slot.details.bookingId}</span>
          `;
        } else if (slot.status === 'held') {
          cardClass = 'held';
          cardContent = `
            <div><strong>PAYMENT HOLD IN PROGRESS</strong> (${slot.details.sport})</div>
            <span>Auto-releases soon</span>
          `;
        } else if (slot.status === 'blocked') {
          cardClass = 'blocked';
          cardContent = `
            <div><strong>BLOCKED: ${slot.details.reason}</strong> ${slot.details.note ? `&bull; ${slot.details.note}` : ''}</div>
            <button type="button" class="btn-table-action" data-unblock-id="${slot.details.blockId}">Unblock</button>
          `;
        }

        row.innerHTML = `
          <span class="cal-slot-time">${slot.startTime} - ${slot.endTime}</span>
          <div class="cal-slot-card ${cardClass}">
            ${cardContent}
          </div>
          <div style="font-size: 0.74rem; color: var(--color-text-muted); text-align: right;">
            ${slot.status === 'available' ? 'Shared Arena Open' : 'Arena Occupied'}
          </div>
        `;

        // Action handlers
        const blockBtn = row.querySelector('[data-time]');
        if (blockBtn) {
          blockBtn.addEventListener('click', () => {
            openBlockModalWithPreset(dateStr, slot.startTime, slot.endTime);
          });
        }

        const unblockBtn = row.querySelector('[data-unblock-id]');
        if (unblockBtn) {
          unblockBtn.addEventListener('click', async () => {
            if (confirm('Unblock this slot and restore availability for both Cricket & Football?')) {
              await DataService.unblockSlot(slot.details.blockId);
              loadSharedCalendar(dateStr);
              refreshOverviewMetrics();
            }
          });
        }

        calendarSlotsList.appendChild(row);
      });
    } catch (err) {
      console.error('Failed to load shared calendar:', err);
    }
  }

  calendarDatePicker.addEventListener('change', () => {
    currentCalendarDate = calendarDatePicker.value;
    loadSharedCalendar(currentCalendarDate);
  });

  btnCalToday.addEventListener('click', () => {
    currentCalendarDate = new Date().toISOString().split('T')[0];
    calendarDatePicker.value = currentCalendarDate;
    loadSharedCalendar(currentCalendarDate);
  });

  btnCalPrev.addEventListener('click', () => {
    const d = new Date(currentCalendarDate);
    d.setDate(d.getDate() - 1);
    currentCalendarDate = d.toISOString().split('T')[0];
    calendarDatePicker.value = currentCalendarDate;
    loadSharedCalendar(currentCalendarDate);
  });

  btnCalNext.addEventListener('click', () => {
    const d = new Date(currentCalendarDate);
    d.setDate(d.getDate() + 1);
    currentCalendarDate = d.toISOString().split('T')[0];
    calendarDatePicker.value = currentCalendarDate;
    loadSharedCalendar(currentCalendarDate);
  });

  // =========================================================================
  // 6. MANUAL SLOT BLOCKING (With Overlap Validation)
  // =========================================================================
  function openBlockModalWithPreset(date, start, end) {
    document.getElementById('blockDateInput').value = date;
    document.getElementById('blockStartTime').value = start;
    document.getElementById('blockEndTime').value = end;
    blockErrorBanner.style.display = 'none';
    modalBlockSlot.classList.add('open');
    modalBlockSlot.setAttribute('aria-hidden', 'false');
  }

  [btnOpenBlockModal, btnQuickBlockModal].forEach(btn => {
    btn?.addEventListener('click', () => {
      openBlockModalWithPreset(currentCalendarDate, '07:00', '08:00');
    });
  });

  function closeBlockModal() {
    modalBlockSlot.classList.remove('open');
    modalBlockSlot.setAttribute('aria-hidden', 'true');
  }

  [btnCloseBlockModal, btnCancelBlockModal].forEach(b => b?.addEventListener('click', closeBlockModal));

  formManualBlock.addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic('medium');
    blockErrorBanner.style.display = 'none';

    const date = document.getElementById('blockDateInput').value;
    const startTime = document.getElementById('blockStartTime').value;
    const endTime = document.getElementById('blockEndTime').value;
    const reason = document.getElementById('blockReasonSelect').value;
    const internalNote = document.getElementById('blockInternalNote').value.trim();

    if (startTime >= endTime) {
      blockErrorBanner.innerText = 'End time must be after start time.';
      blockErrorBanner.style.display = 'block';
      return;
    }

    try {
      await DataService.blockSlot({ date, startTime, endTime, reason, internalNote });
      triggerHaptic('light');
      closeBlockModal();
      loadBlockedSlotsTable();
      loadSharedCalendar(currentCalendarDate);
      refreshOverviewMetrics();
      alert(`Ground successfully blocked on ${date} (${startTime} - ${endTime}) for ${reason}.`);
    } catch (err) {
      triggerHaptic('warning');
      blockErrorBanner.innerText = err.message;
      blockErrorBanner.style.display = 'block';
    }
  });

  async function loadBlockedSlotsTable() {
    const tableBody = document.getElementById('blocksTableBody');
    const emptyPlaceholder = document.getElementById('emptyBlocksPlaceholder');
    try {
      const blocks = await DataService.getBlockedSlots();
      tableBody.innerHTML = '';

      if (blocks.length === 0) {
        emptyPlaceholder.style.display = 'block';
        return;
      }
      emptyPlaceholder.style.display = 'none';

      blocks.forEach(b => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${b.block_date}</strong></td>
          <td><span style="font-family: var(--font-mono); color: var(--color-accent-secondary);">${b.start_time} - ${b.end_time}</span></td>
          <td><span class="status-pill cancelled">${b.reason}</span></td>
          <td>${b.internal_note || '—'}</td>
          <td>${b.created_by}</td>
          <td>
            <button type="button" class="btn-table-action" data-unblock="${b.id}">Unblock</button>
          </td>
        `;

        tr.querySelector('[data-unblock]').addEventListener('click', async () => {
          if (confirm(`Remove block on ${b.block_date} (${b.start_time} - ${b.end_time})?`)) {
            await DataService.unblockSlot(b.id);
            loadBlockedSlotsTable();
            refreshOverviewMetrics();
            loadSharedCalendar(currentCalendarDate);
          }
        });

        tableBody.appendChild(tr);
      });
    } catch (err) {
      console.error('Failed to load blocks:', err);
    }
  }

  // =========================================================================
  // 7. REAL-TIME NOTIFICATIONS & META WHATSAPP LOGS
  // =========================================================================
  async function loadNotifications() {
    try {
      const list = await DataService.getNotifications();
      notificationsFeedList.innerHTML = '';

      const unreadCount = list.filter(n => !n.is_read).length;
      document.getElementById('sidebarAlertCount').innerText = unreadCount;
      bellAlertPip.style.display = unreadCount > 0 ? 'block' : 'none';

      if (list.length === 0) {
        notificationsFeedList.innerHTML = '<p style="color: var(--color-text-muted); text-align: center; padding: 2rem;">No notifications recorded yet.</p>';
      } else {
        list.forEach(n => {
          const item = document.createElement('div');
          item.className = 'notif-feed-item';
          item.innerHTML = `
            <div class="notif-icon-circle">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </div>
            <div class="notif-text-col">
              <span class="notif-title">${n.title}</span>
              <span class="notif-desc">${n.message}</span>
              <span class="notif-time">${new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          `;
          notificationsFeedList.appendChild(item);
        });
      }

      // Load WhatsApp delivery logs
      const logs = await DataService.getDeliveryLogs();
      deliveryLogsList.innerHTML = '';
      if (logs.length === 0) {
        deliveryLogsList.innerHTML = `
          <div style="padding: 1.5rem; text-align: center; color: var(--color-text-muted); font-size: 0.8rem;">
            No live WhatsApp dispatches sent yet.<br/>
            Configure WHATSAPP_API_TOKEN in environment to start sending verified Meta template notifications.
          </div>
        `;
      } else {
        logs.forEach(l => {
          const item = document.createElement('div');
          item.className = 'notif-feed-item';
          item.innerHTML = `
            <div class="notif-text-col" style="width: 100%;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="notif-title">WhatsApp: ${l.event_type}</span>
                <span class="status-pill ${l.status}">${l.status.toUpperCase()}</span>
              </div>
              <span class="notif-desc">Recipient: ${l.recipient} &bull; Booking #${l.booking_id || 'N/A'}</span>
              ${l.error_message ? `<span style="font-size: 0.72rem; color: #FCA5A5;">${l.error_message}</span>` : ''}
              <span class="notif-time">${new Date(l.created_at).toLocaleString('en-IN')}</span>
            </div>
          `;
          deliveryLogsList.appendChild(item);
        });
      }
    } catch (e) {
      console.error('Failed to load notifications:', e);
    }
  }

  btnMarkAllRead?.addEventListener('click', () => {
    DataService.markNotificationsRead();
    loadNotifications();
  });

  // Listen for realtime events (via custom event or Supabase Realtime)
  window.addEventListener('samarth_sports_notification', (e) => {
    playAppleNotificationChime();
    triggerHaptic('medium');
    loadNotifications();
    refreshOverviewMetrics();
    loadBookingsTable();
  });

  // Supabase Realtime subscription when configured
  if (isSupabaseConfigured && supabase) {
    supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        playAppleNotificationChime();
        triggerHaptic('medium');
        refreshOverviewMetrics();
        loadBookingsTable();
        loadSharedCalendar(currentCalendarDate);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_slots' }, () => {
        loadBlockedSlotsTable();
        loadSharedCalendar(currentCalendarDate);
        refreshOverviewMetrics();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_notifications' }, () => {
        playAppleNotificationChime();
        loadNotifications();
      })
      .subscribe();
  }

  // =========================================================================
  // 8. GROUND SETTINGS (Hourly Rates, Operating Hours, Allowlist)
  // =========================================================================
  async function loadSettingsIntoForm() {
    try {
      const s = await DataService.getSettings();
      cfgCricketPrice.value = s.cricket_hourly_price;
      cfgFootballPrice.value = s.football_hourly_price;
      cfgOpenTime.value = s.opening_time;
      cfgCloseTime.value = s.closing_time;
      cfgSlotDuration.value = s.slot_duration_mins || 60;
      cfgAdvanceWindow.value = s.advance_window_days || 14;
      cfgHoldExpiry.value = s.hold_expiry_mins || 10;
      cfgAllowlist.value = (s.owner_email_allowlist || []).join(', ');
      cfgWaPhoneId.value = s.whatsapp_phone_number_id || '';
      cfgWaAccount.value = s.whatsapp_business_account_id || '';
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  }

  groundSettingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    triggerHaptic('medium');
    settingsSaveStatus.innerText = 'Saving settings...';

    const allowlistArr = cfgAllowlist.value
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    const updated = {
      cricket_hourly_price: Number(cfgCricketPrice.value),
      football_hourly_price: Number(cfgFootballPrice.value),
      opening_time: cfgOpenTime.value,
      closing_time: cfgCloseTime.value,
      slot_duration_mins: Number(cfgSlotDuration.value),
      advance_window_days: Number(cfgAdvanceWindow.value),
      hold_expiry_mins: Number(cfgHoldExpiry.value),
      owner_email_allowlist: allowlistArr,
      whatsapp_phone_number_id: cfgWaPhoneId.value.trim(),
      whatsapp_business_account_id: cfgWaAccount.value.trim()
    };

    try {
      await DataService.updateSettings(updated);
      settingsSaveStatus.innerText = '✓ Settings successfully saved & enforced.';
      triggerHaptic('light');
      setTimeout(() => { settingsSaveStatus.innerText = ''; }, 3500);
      refreshOverviewMetrics();
    } catch (err) {
      settingsSaveStatus.innerText = 'Error: ' + err.message;
    }
  });

  // Kick off initial authentication check
  await checkAuthSession();
});
