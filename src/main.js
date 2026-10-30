import './style.css';
import gsap from 'gsap';
import { FootballIntro } from './footballIntro.js';

document.addEventListener('DOMContentLoaded', () => {
  const introContainer = document.getElementById('football-intro');
  const homepage = document.getElementById('homepage');
  const scrollWrapper = document.getElementById('scrollWrapper');

  // Modals & Navigation
  const bookingModal = document.getElementById('bookingModal');
  const exploreModal = document.getElementById('exploreModal');
  const bottomNavBar = document.getElementById('bottomNavBar');
  const navHomeBtn = document.getElementById('navHomeBtn');
  const navBookingBtn = document.getElementById('navBookingBtn');

  // Header Menu
  const menuToggleBtn = document.getElementById('menuToggleBtn');
  const siteNavMenu = document.getElementById('siteNavMenu');
  const navDrawerBackdrop = document.getElementById('navDrawerBackdrop');
  const btnMenuBookNow = document.getElementById('btnMenuBookNow');

  let selectedSport = 'Football';

  // =========================================================================
  // 0. HAPTIC FEEDBACK (Apple Taptic Engine emulation where supported)
  // =========================================================================
  function triggerHaptic(type = 'light') {
    try {
      if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        if (type === 'light') {
          navigator.vibrate(8);
        } else if (type === 'medium') {
          navigator.vibrate(15);
        } else if (type === 'success') {
          navigator.vibrate([12, 35, 16]);
        } else if (type === 'warning') {
          navigator.vibrate([18, 25, 18]);
        }
      }
    } catch (_) {
      // Graceful fallback when haptics are not supported or disabled
    }
  }

  // =========================================================================
  // 1. OPENING FOOTBALL INTRO TO HOMEPAGE TRANSITION
  // =========================================================================
  let homepageRevealed = false;

  function revealHomepage(immediate = false) {
    if (homepageRevealed) return;
    homepageRevealed = true;

    if (!homepage) return;
    homepage.removeAttribute('aria-hidden');
    homepage.classList.add('active');

    const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Immediate layout for reduced-motion preference
    if (immediate || isReducedMotion) {
      gsap.set([
        '.site-header',
        '.section-sport-selection',
        '#cardCricket',
        '#cardFootball',
        '.section-ground-showcase',
        '.section-facilities',
        '.section-how-it-works',
        '.section-location',
        '.section-final-cta',
        '.fixed-bottom-nav'
      ], {
        opacity: 1,
        y: 0,
        scale: 1,
        clearProps: 'all'
      });
      return;
    }

    // Single Controlled GSAP Master Timeline for Apple-Style Coordinated Entrance
    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' }
    });

    // 1. Site Header slides down naturally
    tl.fromTo('.site-header',
      { y: -18, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.46 },
      0
    );

    // 2. Sport selection section container
    tl.fromTo('.section-sport-selection',
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.5 },
      0.06
    );

    // 3. Cricket & Football banners enter with subtle coordinated motion
    tl.fromTo('#cardCricket',
      { opacity: 0, y: 22, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.54, ease: 'power2.out' },
      0.12
    );

    tl.fromTo('#cardFootball',
      { opacity: 0, y: 22, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 0.54, ease: 'power2.out' },
      0.18
    );

    // 4. Ground Showcase card reveals smoothly
    tl.fromTo('.section-ground-showcase',
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.56 },
      0.26
    );

    // 5. Facilities & Features
    tl.fromTo('.section-facilities',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.52 },
      0.34
    );

    // 6. Fixed Bottom Navigation appears elegantly with spring feel
    tl.fromTo('.fixed-bottom-nav',
      { opacity: 0, y: 28, scale: 0.97 },
      { opacity: 1, y: 0, scale: 1, duration: 0.58, ease: 'power3.out' },
      0.38
    );
  }

  // Football Intro Initialization
  let introInstance = null;
  if (introContainer) {
    introInstance = new FootballIntro(introContainer, {
      onReveal: () => {
        // Trigger coordinated homepage entrance right as football passes camera
        revealHomepage(false);
      },
      onComplete: () => {
        // Intro complete
      }
    });

    // Tap/touch during intro to skip smoothly to homepage
    let hasSkipped = false;
    const skipHandler = () => {
      if (!hasSkipped && performance.now() > 500) {
        hasSkipped = true;
        triggerHaptic('light');
        introInstance?.destroy();
        introContainer.style.display = 'none';
        revealHomepage(false);
      }
    };
    introContainer.addEventListener('click', skipHandler);
    introContainer.addEventListener('touchend', skipHandler);

    // Global hook to test or replay the intro at any time
    window.replayIntro = () => {
      homepageRevealed = false;
      homepage.setAttribute('aria-hidden', 'true');
      homepage.classList.remove('active');
      introContainer.style.display = 'block';
      introContainer.style.opacity = '1';
      introInstance?.resetToInitialState();
      introInstance?.playAnimation();
    };
  } else {
    revealHomepage(true);
  }

  // =========================================================================
  // 2. APPLE-STYLE HAMBURGER-TO-CLOSE MENU & TRANSLUCENT DRAWER
  // =========================================================================
  function openMenu() {
    menuToggleBtn?.classList.add('open');
    menuToggleBtn?.setAttribute('aria-expanded', 'true');
    siteNavMenu?.classList.add('open');
    siteNavMenu?.removeAttribute('aria-hidden');
    triggerHaptic('light');
  }

  function closeMenu() {
    menuToggleBtn?.classList.remove('open');
    menuToggleBtn?.setAttribute('aria-expanded', 'false');
    siteNavMenu?.classList.remove('open');
    siteNavMenu?.setAttribute('aria-hidden', 'true');
    triggerHaptic('light');
  }

  function toggleMenu() {
    const isOpen = menuToggleBtn?.classList.contains('open');
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  menuToggleBtn?.addEventListener('click', toggleMenu);
  navDrawerBackdrop?.addEventListener('click', closeMenu);

  // Smooth scroll for drawer links
  document.querySelectorAll('.menu-nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      const sectionId = link.getAttribute('data-section');
      closeMenu();
      if (sectionId) {
        const target = document.getElementById(sectionId);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });
  });

  btnMenuBookNow?.addEventListener('click', () => {
    closeMenu();
    openBookingModal();
  });

  // =========================================================================
  // 3. FIXED BOTTOM NAVIGATION (Sliding Active Indicator & Zero Flicker)
  // =========================================================================
  function updateNavState(activeTab) {
    if (!bottomNavBar) return;
    bottomNavBar.dataset.active = activeTab;

    if (activeTab === 'home') {
      navHomeBtn?.classList.add('active');
      navHomeBtn?.setAttribute('aria-current', 'page');
      navBookingBtn?.classList.remove('active');
      navBookingBtn?.removeAttribute('aria-current');
    } else {
      navBookingBtn?.classList.add('active');
      navBookingBtn?.setAttribute('aria-current', 'page');
      navHomeBtn?.classList.remove('active');
      navHomeBtn?.removeAttribute('aria-current');
    }
  }

  // =========================================================================
  // 4. SPORT SELECTION BANNERS (Cricket & Football for Shared Turf)
  // =========================================================================
  const cardCricket = document.getElementById('cardCricket');
  const cardFootball = document.getElementById('cardFootball');

  function selectSport(sport) {
    selectedSport = sport;
    triggerHaptic('light');

    if (sport === 'Cricket') {
      cardCricket?.classList.add('selected');
      cardFootball?.classList.remove('selected');
    } else {
      cardFootball?.classList.add('selected');
      cardCricket?.classList.remove('selected');
    }

    // Sync modal sport tabs
    document.querySelectorAll('.sport-tab').forEach(tab => {
      if (tab.dataset.sport === sport) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }

  // Apple touch feedback on sport banners
  [cardCricket, cardFootball].forEach(card => {
    if (!card) return;
    card.addEventListener('pointerdown', () => triggerHaptic('light'));
  });

  cardCricket?.addEventListener('click', () => {
    selectSport('Cricket');
    openBookingModal();
  });

  cardFootball?.addEventListener('click', () => {
    selectSport('Football');
    openBookingModal();
  });

  // =========================================================================
  // 5. EXPLORE GROUND MODAL
  // =========================================================================
  const btnExploreGround = document.getElementById('btnExploreGround');
  const exploreCloseBtn = document.getElementById('exploreModalCloseBtn');
  const btnExploreBookNow = document.getElementById('btnExploreBookNow');

  function openExploreModal() {
    triggerHaptic('light');
    exploreModal?.classList.add('open');
    exploreModal?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeExploreModal() {
    triggerHaptic('light');
    exploreModal?.classList.remove('open');
    exploreModal?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  btnExploreGround?.addEventListener('click', openExploreModal);
  exploreCloseBtn?.addEventListener('click', closeExploreModal);

  btnExploreBookNow?.addEventListener('click', () => {
    closeExploreModal();
    openBookingModal();
  });

  // =========================================================================
  // 6. BOOKING MODAL & BOTTOM NAVIGATION COORDINATION
  // =========================================================================
  const btnBookSlotCta = document.getElementById('btnBookSlotCta');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const btnConfirmSlot = document.getElementById('btnConfirmSlot');

  function openBookingModal() {
    updateNavState('booking');
    triggerHaptic('medium');
    bookingModal?.classList.add('open');
    bookingModal?.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeBookingModal() {
    updateNavState('home');
    triggerHaptic('light');
    bookingModal?.classList.remove('open');
    bookingModal?.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  navBookingBtn?.addEventListener('click', () => {
    openBookingModal();
  });

  navHomeBtn?.addEventListener('click', () => {
    closeBookingModal();
    closeExploreModal();
    closeMenu();
    triggerHaptic('light');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    scrollWrapper?.scrollTo({ top: 0, behavior: 'smooth' });
  });

  btnBookSlotCta?.addEventListener('click', openBookingModal);
  modalCloseBtn?.addEventListener('click', closeBookingModal);

  // Close modals on backdrop click
  [bookingModal, exploreModal].forEach(modal => {
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (modal === bookingModal) closeBookingModal();
        if (modal === exploreModal) closeExploreModal();
      }
    });
  });

  // Keyboard accessibility: Escape key closes active overlays
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (siteNavMenu?.classList.contains('open')) closeMenu();
      if (bookingModal?.classList.contains('open')) closeBookingModal();
      if (exploreModal?.classList.contains('open')) closeExploreModal();
    }
  });

  // Modal Sport Tabs
  document.querySelectorAll('.sport-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.sport-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      selectSport(tab.dataset.sport);
      triggerHaptic('light');
    });
  });

  // =========================================================================
  // 7. DYNAMIC CALENDAR GENERATION (Native CSS snap-scroll & active states)
  // =========================================================================
  function setupDynamicCalendar() {
    const dateRow = document.getElementById('modalDateRow');
    if (!dateRow) return;

    dateRow.innerHTML = '';
    const now = new Date();

    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
      const month = d.toLocaleDateString(undefined, { month: 'short' });
      const dayNum = d.getDate();

      const dayTitle = i === 0 ? 'Today' : (i === 1 ? 'Tomorrow' : weekday);
      const isoDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `date-chip ${i === 0 ? 'active' : ''}`;
      chip.setAttribute('data-date', isoDate);
      chip.setAttribute('aria-label', `${dayTitle}, ${month} ${dayNum}`);
      chip.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');

      chip.innerHTML = `
        <span class="date-chip-day">${dayTitle}</span>
        <span class="date-chip-num">${dayNum}</span>
        <span class="date-chip-month">${month}</span>
      `;

      chip.addEventListener('click', () => {
        triggerHaptic('light');
        dateRow.querySelectorAll('.date-chip').forEach(c => {
          c.classList.remove('active');
          c.setAttribute('aria-pressed', 'false');
        });
        chip.classList.add('active');
        chip.setAttribute('aria-pressed', 'true');
      });

      dateRow.appendChild(chip);
    }
  }

  setupDynamicCalendar();

  // =========================================================================
  // 8. TIME SLOT CHIPS (Distinct Active and Unavailable States)
  // =========================================================================
  document.querySelectorAll('.slot-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      // Check if slot is unavailable / booked
      if (chip.classList.contains('unavailable') || chip.disabled) {
        triggerHaptic('warning');
        // Subtle rejection shake indicating slot unavailable
        gsap.fromTo(chip,
          { x: -5 },
          {
            x: 5,
            duration: 0.07,
            repeat: 3,
            yoyo: true,
            ease: 'power2.inOut',
            onComplete: () => gsap.set(chip, { x: 0 })
          }
        );
        return;
      }

      // Available slot selected
      triggerHaptic('light');
      document.querySelectorAll('.slot-chip').forEach(c => {
        c.classList.remove('active');
        c.removeAttribute('aria-selected');
      });
      chip.classList.add('active');
      chip.setAttribute('aria-selected', 'true');

      // Subtle spring animation
      gsap.fromTo(chip,
        { scale: 0.95 },
        { scale: 1, duration: 0.3, ease: 'back.out(1.7)' }
      );
    });
  });

  // =========================================================================
  // 9. PRIMARY CONFIRMATION BUTTON WITH TAPTIC FEEDBACK
  // =========================================================================
  btnConfirmSlot?.addEventListener('click', () => {
    triggerHaptic('success');
    const activeDateChip = document.querySelector('.date-chip.active');
    const dayLabel = activeDateChip?.querySelector('.date-chip-day')?.innerText || 'Today';
    const dateNum = activeDateChip?.querySelector('.date-chip-num')?.innerText || '';
    const month = activeDateChip?.querySelector('.date-chip-month')?.innerText || '';
    const activeDate = `${dayLabel} (${month} ${dateNum})`;
    const activeSlot = document.querySelector('.slot-chip.active')?.innerText || '07:00 PM - 08:00 PM (Floodlights)';

    alert(`Slot Confirmed for ${selectedSport} on Samarth Sports Shared Turf!\n\nDate: ${activeDate}\nTime: ${activeSlot}\n\nProceeding to final booking confirmation.`);
    closeBookingModal();
  });

  // Open in Maps
  const btnOpenMaps = document.getElementById('btnOpenMaps');
  btnOpenMaps?.addEventListener('click', () => {
    triggerHaptic('light');
    alert('Samarth Sports Turf Location: The exact GPS pin and directions will be updated soon.');
  });
});
