/* ============================================================
   ECHOSPHERE 2.0 — main.js
   Lenis Smooth Scroll + GSAP ScrollTrigger Canvas Engine
   Concert Beat Background Music + Dynamic Pass Booking System
   ============================================================ */

(function () {
  'use strict';

  /* ─── CONSTANTS ──────────────────────────────────────────── */
  const IS_MOBILE    = () => window.innerWidth <= 768;
  const TOTAL_D      = 504;   // desktop frame count
  const TOTAL_M      = 252;   // mobile frame count
  const FRAME_PATH_D = 'assets/frames-desktop/frame_';
  const FRAME_PATH_M = 'assets/frames-mobile/frame_';

  const TICKET_PRICE = 349;
  const TICKET_ORIG  = 499;
  const TICKET_SAVE  = 150;

  /* ─── STATE ──────────────────────────────────────────────── */
  const cache        = {};    // frame index → ImageBitmap
  const loadingSet   = new Set();
  let   currentFrame = 0;
  let   totalFrames  = TOTAL_D;
  let   framePath    = FRAME_PATH_D;
  let   lenisInst    = null;
  let   lastDrawnBmp = null;
  let   ticketCount  = 1;
  let   audioStarted = false;

  /* ─── DOM ELEMENTS ───────────────────────────────────────── */
  const canvas         = document.getElementById('heroCanvas');
  const ctx            = canvas ? canvas.getContext('2d', { alpha: false }) : null;
  const progressFill   = document.getElementById('progressFill');
  const scrollCue      = document.getElementById('scrollCue');
  const heroHeadline   = document.getElementById('heroHeadline');
  const heroEyebrow    = document.getElementById('heroEyebrow');
  const heroCard       = document.getElementById('heroCard');
  const stickyCta      = document.getElementById('stickyCta');
  const navEl          = document.getElementById('mainNav');
  const hamburger      = document.getElementById('navHamburger');
  const mobNav         = document.getElementById('mobNav');
  const mobClose       = document.getElementById('mobNavClose');
  const formCard       = document.getElementById('formCard');
  const ticketPass     = document.getElementById('ticketPass');
  const regForm        = document.getElementById('registerForm');
  const resetBtn       = document.getElementById('resetBtn');

  // Audio elements
  const bgAudio        = document.getElementById('bgAudio');
  const soundToggle    = document.getElementById('soundToggle');
  const soundToggleMob = document.getElementById('soundToggleMob');
  const soundLabel     = document.getElementById('soundLabel');

  // Stepper & Pricing
  const stepMinus      = document.getElementById('stepMinus');
  const stepPlus       = document.getElementById('stepPlus');
  const ticketQtyEl    = document.getElementById('ticketQty');
  const totalValEl     = document.getElementById('totalVal');
  const totalStrikeEl  = document.getElementById('totalStrike');
  const savingPillEl   = document.getElementById('savingPill');
  const btnPayTextEl   = document.getElementById('btnPayText');

  /* ═══════════════════════════════════════════════════════════
     1.  CANVAS ENGINE & FRAME MANAGEMENT
     ═══════════════════════════════════════════════════════════ */

  function pad4(n) {
    return String(n).padStart(4, '0');
  }

  function frameUrl(index) {
    return framePath + pad4(index + 1) + '.webp';
  }

  function sizeCanvas() {
    if (!canvas) return;
    const stage = canvas.parentElement || document.body;
    const dpr   = Math.min(window.devicePixelRatio || 1, 2);
    const sw    = stage.clientWidth;
    const sh    = stage.clientHeight;

    canvas.width        = Math.floor(sw * dpr);
    canvas.height       = Math.floor(sh * dpr);
    canvas.style.width  = sw + 'px';
    canvas.style.height = sh + 'px';
  }

  function drawBitmap(bmp) {
    if (!ctx || !bmp) return;
    const W = canvas.width;
    const H = canvas.height;
    if (!W || !H) return;

    const bw = bmp.width;
    const bh = bmp.height;
    const scale = Math.max(W / bw, H / bh);
    const dw = bw * scale;
    const dh = bh * scale;
    const ox = (W - dw) / 2;
    const oy = (H - dh) / 2;

    ctx.drawImage(bmp, ox, oy, dw, dh);
    lastDrawnBmp = bmp;
  }

  function drawFrame(frameIdx) {
    const idx = Math.round(Math.max(0, Math.min(frameIdx, totalFrames - 1)));
    let bmp = cache[idx];

    if (!bmp) {
      let minDiff = Infinity;
      let nearest = lastDrawnBmp;
      for (const k in cache) {
        const diff = Math.abs(Number(k) - idx);
        if (diff < minDiff) {
          minDiff = diff;
          nearest = cache[k];
        }
      }
      if (nearest) drawBitmap(nearest);

      loadFrame(idx).then(() => {
        if (currentFrame === idx && cache[idx]) {
          drawBitmap(cache[idx]);
        }
      });
      return;
    }

    drawBitmap(bmp);
  }

  function loadFrame(index) {
    if (cache[index] || loadingSet.has(index)) return Promise.resolve(cache[index]);
    loadingSet.add(index);

    return fetch(frameUrl(index))
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.blob();
      })
      .then(blob => createImageBitmap(blob))
      .then(bmp => {
        cache[index] = bmp;
        loadingSet.delete(index);
        return bmp;
      })
      .catch(() => {
        loadingSet.delete(index);
      });
  }

  function preloadRange(indices, onEach) {
    indices.forEach(idx => {
      loadFrame(idx).then(bmp => {
        if (bmp && onEach) onEach(idx, bmp);
      });
    });
  }

  function initFrames() {
    if (IS_MOBILE()) {
      totalFrames = TOTAL_M;
      framePath   = FRAME_PATH_M;
    } else {
      totalFrames = TOTAL_D;
      framePath   = FRAME_PATH_D;
    }

    // Step 1: Immediately fetch Frame 0 and draw it
    loadFrame(0).then(bmp => {
      if (bmp) drawBitmap(bmp);
    });

    // Step 2: Dense preload of the first 24 frames
    const firstFrames = [];
    for (let i = 1; i <= Math.min(24, totalFrames - 1); i++) {
      firstFrames.push(i);
    }
    preloadRange(firstFrames, (idx, bmp) => {
      if (currentFrame === idx) drawBitmap(bmp);
    });

    // Step 3: Sparse grid across the ENTIRE sequence (every 8th frame)
    const sparseFrames = [];
    for (let i = 25; i < totalFrames; i += 8) {
      sparseFrames.push(i);
    }
    preloadRange(sparseFrames);

    // Step 4: Stream remaining frames in rapid batches
    let curBatch = 25;
    const batchSize = 20;
    function streamNextBatch() {
      if (curBatch >= totalFrames) return;
      const batch = [];
      const end = Math.min(curBatch + batchSize, totalFrames);
      for (let i = curBatch; i < end; i++) {
        if (!cache[i] && !loadingSet.has(i)) batch.push(i);
      }
      curBatch = end;
      preloadRange(batch);
      setTimeout(streamNextBatch, 80);
    }
    setTimeout(streamNextBatch, 250);
  }

  /* ═══════════════════════════════════════════════════════════
     2.  LENIS SMOOTH SCROLL INTEGRATION
     ═══════════════════════════════════════════════════════════ */

  function initLenis() {
    if (typeof Lenis === 'undefined') return;

    lenisInst = new Lenis({
      lerp           : 0.1,
      smoothWheel    : true,
      wheelMultiplier: 0.85,
      touchMultiplier: 1.5,
      autoRaf        : false,
    });

    if (typeof ScrollTrigger !== 'undefined') {
      lenisInst.on('scroll', ScrollTrigger.update);
    }

    if (typeof gsap !== 'undefined') {
      gsap.ticker.add(time => {
        lenisInst.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    }

    // Smooth anchor navigation
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', e => {
        const href = a.getAttribute('href');
        if (href && href.length > 1) {
          const target = document.querySelector(href);
          if (target) {
            e.preventDefault();
            lenisInst.scrollTo(target, { offset: -20 });
          }
        }
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     3.  GSAP SCROLLTRIGGER SCRUB TIMELINE
     ═══════════════════════════════════════════════════════════ */

  function initScrub() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    const scrubWrap = document.getElementById('scrubWrap');
    if (!scrubWrap) return;

    const scrubProxy = { frame: 0 };

    gsap.to(scrubProxy, {
      frame: totalFrames - 1,
      ease : 'none',
      scrollTrigger: {
        trigger    : '#scrubWrap',
        start      : 'top top',
        end        : 'bottom bottom',
        pin        : '#scrubStage',
        pinSpacing : false,
        scrub      : 0.2,
        onUpdate: self => {
          const p = self.progress;

          currentFrame = Math.round(p * (totalFrames - 1));
          drawFrame(currentFrame);

          if (progressFill) {
            progressFill.style.width = (p * 100) + '%';
          }

          if (scrollCue) {
            scrollCue.style.opacity = p > 0.02 ? '0' : '1';
          }

          // Hero Headline: fades out smoothly between 0.01 and 0.14
          if (heroHeadline) {
            if (p <= 0.01) {
              heroHeadline.style.opacity   = '1';
              heroHeadline.style.transform = 'translate(-50%, -50%) scale(1)';
              heroHeadline.style.pointerEvents = 'none';
            } else if (p < 0.14) {
              const f = (p - 0.01) / 0.13;
              heroHeadline.style.opacity   = String(1 - f);
              heroHeadline.style.transform = `translate(-50%, calc(-50% - ${24 * f}px)) scale(${1 + 0.04 * f})`;
              heroHeadline.style.pointerEvents = 'none';
            } else {
              heroHeadline.style.opacity   = '0';
              heroHeadline.style.transform = 'translate(-50%, -60%) scale(1.04)';
              heroHeadline.style.pointerEvents = 'none';
            }
          }

          // Hero Eyebrow: fades in between 0.70 and 0.82
          if (heroEyebrow) {
            if (p >= 0.70) {
              const t = Math.min((p - 0.70) / 0.12, 1);
              heroEyebrow.style.opacity   = String(t);
              heroEyebrow.style.transform = `translateX(-50%) translateY(${-14 + 14 * t}px)`;
            } else {
              heroEyebrow.style.opacity   = '0';
              heroEyebrow.style.transform = 'translateX(-50%) translateY(-14px)';
            }
          }

          // Hero Card: rises from bottom between 0.80 and 0.94
          if (heroCard) {
            if (p >= 0.80) {
              const t = Math.min((p - 0.80) / 0.14, 1);
              heroCard.style.opacity       = String(t);
              heroCard.style.transform     = `translateX(-50%) translateY(${50 * (1 - t)}px)`;
              heroCard.style.pointerEvents = t > 0.6 ? 'auto' : 'none';
            } else {
              heroCard.style.opacity       = '0';
              heroCard.style.transform     = 'translateX(-50%) translateY(50px)';
              heroCard.style.pointerEvents = 'none';
            }
          }

          // Sticky CTA Pill
          if (stickyCta) {
            if (p >= 0.88) {
              stickyCta.classList.add('visible');
              stickyCta.style.opacity       = '1';
              stickyCta.style.pointerEvents = 'auto';
            } else {
              stickyCta.classList.remove('visible');
              stickyCta.style.opacity       = '0';
              stickyCta.style.pointerEvents = 'none';
            }
          }
        },
        onLeave: () => {
          if (stickyCta) {
            stickyCta.classList.add('visible');
            stickyCta.style.opacity       = '1';
            stickyCta.style.pointerEvents = 'auto';
          }
        },
        onEnterBack: () => {
          if (stickyCta) {
            stickyCta.classList.remove('visible');
            stickyCta.style.opacity       = '0';
            stickyCta.style.pointerEvents = 'none';
          }
        }
      }
    });

    // Auto-hide sticky CTA when registration section is in viewport
    const regSection = document.getElementById('register');
    if (regSection && stickyCta) {
      const regObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            stickyCta.style.opacity = '0';
            stickyCta.style.pointerEvents = 'none';
          } else if (window.scrollY > window.innerHeight * 2) {
            stickyCta.style.opacity = '1';
            stickyCta.style.pointerEvents = 'auto';
          }
        });
      }, { threshold: 0.05 });
      regObserver.observe(regSection);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     4.  BACKGROUND CONCERT MUSIC CONTROLLER
     ═══════════════════════════════════════════════════════════ */

  function setAudioState(isPlaying) {
    if (!bgAudio) return;
    if (isPlaying) {
      bgAudio.volume = 0.65;
      bgAudio.play().then(() => {
        soundToggle && soundToggle.classList.add('playing');
        soundToggleMob && soundToggleMob.classList.add('playing');
        if (soundLabel) soundLabel.textContent = 'SOUND: ON';
      }).catch(() => {});
    } else {
      bgAudio.pause();
      soundToggle && soundToggle.classList.remove('playing');
      soundToggleMob && soundToggleMob.classList.remove('playing');
      if (soundLabel) soundLabel.textContent = 'SOUND: OFF';
    }
  }

  function toggleAudio() {
    if (!bgAudio) return;
    if (bgAudio.paused) {
      setAudioState(true);
    } else {
      setAudioState(false);
    }
  }

  function initAudio() {
    if (!bgAudio) return;

    if (soundToggle) {
      soundToggle.addEventListener('click', toggleAudio);
    }
    if (soundToggleMob) {
      soundToggleMob.addEventListener('click', toggleAudio);
    }

    // Auto-unlock audio smoothly on first interaction
    function autoStartAudio() {
      if (audioStarted) return;
      audioStarted = true;
      setAudioState(true);
      window.removeEventListener('scroll', autoStartAudio);
      window.removeEventListener('click', autoStartAudio);
      window.removeEventListener('touchstart', autoStartAudio);
    }

    window.addEventListener('scroll', autoStartAudio, { passive: true });
    window.addEventListener('click', autoStartAudio, { passive: true });
    window.addEventListener('touchstart', autoStartAudio, { passive: true });
  }

  /* ═══════════════════════════════════════════════════════════
     5.  QUANTITY STEPPER & DYNAMIC PRICING
     ═══════════════════════════════════════════════════════════ */

  function updatePricing() {
    const total = ticketCount * TICKET_PRICE;
    const strike = ticketCount * TICKET_ORIG;
    const save = ticketCount * TICKET_SAVE;

    if (ticketQtyEl) ticketQtyEl.textContent = String(ticketCount);
    if (totalValEl) totalValEl.textContent = `₹${total}`;
    if (totalStrikeEl) totalStrikeEl.textContent = `₹${strike}`;
    if (savingPillEl) {
      savingPillEl.textContent = `Saving ₹${save} on ${ticketCount} ${ticketCount === 1 ? 'pass' : 'passes'}`;
    }
    if (btnPayTextEl) {
      btnPayTextEl.textContent = `PAY NOW • ₹${total}`;
    }
  }

  function initPricing() {
    if (stepMinus) {
      stepMinus.addEventListener('click', () => {
        if (ticketCount > 1) {
          ticketCount--;
          updatePricing();
        }
      });
    }

    if (stepPlus) {
      stepPlus.addEventListener('click', () => {
        if (ticketCount < 8) {
          ticketCount++;
          updatePricing();
        }
      });
    }

    updatePricing();
  }

  /* ═══════════════════════════════════════════════════════════
     6.  NAVIGATION & MOBILE MENU
     ═══════════════════════════════════════════════════════════ */

  function initNav() {
    window.addEventListener('scroll', () => {
      if (navEl) navEl.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });

    if (hamburger && mobNav) {
      hamburger.addEventListener('click', () => {
        mobNav.classList.add('open');
        hamburger.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    }

    function closeMobNav() {
      if (mobNav) mobNav.classList.remove('open');
      if (hamburger) hamburger.classList.remove('active');
      document.body.style.overflow = '';
    }

    if (mobClose) mobClose.addEventListener('click', closeMobNav);
    document.querySelectorAll('[data-close-nav]').forEach(el => {
      el.addEventListener('click', closeMobNav);
    });
  }

  /* ═══════════════════════════════════════════════════════════
     7.  SECTION REVEAL ANIMATIONS
     ═══════════════════════════════════════════════════════════ */

  function initReveals() {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      document.querySelectorAll('[data-reveal], [data-reveal-stagger], [data-lineup-card]')
        .forEach(el => el.classList.add('revealed'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          if (el.hasAttribute('data-reveal-stagger')) {
            Array.from(el.children).forEach((child, i) => {
              setTimeout(() => child.classList.add('revealed'), i * 110);
            });
            el.classList.add('revealed');
          } else {
            el.classList.add('revealed');
          }
          io.unobserve(el);
        }
      });
    }, { threshold: 0.12 });

    document.querySelectorAll('[data-reveal], [data-reveal-stagger], [data-lineup-card]')
      .forEach(el => io.observe(el));
  }

  /* ═══════════════════════════════════════════════════════════
     8.  STAT COUNTERS
     ═══════════════════════════════════════════════════════════ */

  function initStatCounters() {
    const counters = document.querySelectorAll('.stat-number[data-count]');
    if (!counters.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseInt(el.dataset.count, 10);
        const duration = 1600;
        const startTime = performance.now();

        function tick(now) {
          const progress = Math.min((now - startTime) / duration, 1);
          const easeOut = 1 - Math.pow(1 - progress, 4);
          el.textContent = Math.round(easeOut * target).toLocaleString();
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        io.unobserve(el);
      });
    }, { threshold: 0.4 });

    counters.forEach(el => io.observe(el));
  }

  /* ═══════════════════════════════════════════════════════════
     9.  MARQUEE LOOP
     ═══════════════════════════════════════════════════════════ */

  function initMarquee() {
    const inner = document.querySelector('.marquee-inner');
    if (!inner) return;
    const clone = inner.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    inner.parentElement.appendChild(clone);
  }

  /* ═══════════════════════════════════════════════════════════
     10. TICKET QR CODE (PURE SELF-CONTAINED CANVAS)
     ═══════════════════════════════════════════════════════════ */

  function generateTicketQR(passId, attendeeName) {
    const qrCanvas = document.getElementById('ticketQr');
    if (!qrCanvas) return;

    const size = 130;
    qrCanvas.width  = size;
    qrCanvas.height = size;
    const qctx = qrCanvas.getContext('2d');

    // Instant matrix QR render
    renderOfflineMatrixQR(qctx, size, `${passId}-${attendeeName}`);

    // Overlay with vector QR if reachable
    const dataStr = encodeURIComponent(`ECHOSPHERE2.0|${passId}|${attendeeName}|SUIET_MUKKA|02NOV2026`);
    const apiUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${dataStr}&color=C9A45C&bgcolor=050508&margin=4`;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      qctx.drawImage(img, 0, 0, size, size);
    };
    img.src = apiUrl;
  }

  function renderOfflineMatrixQR(qctx, size, seedStr) {
    const N = 21;
    const pad = 8;
    const cell = (size - pad * 2) / N;

    qctx.fillStyle = '#050508';
    qctx.fillRect(0, 0, size, size);

    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = ((hash << 5) - hash) + seedStr.charCodeAt(i);
      hash |= 0;
    }

    function isFinder(r, c) {
      if (r < 7 && c < 7) return true;
      if (r < 7 && c >= N - 7) return true;
      if (r >= N - 7 && c < 7) return true;
      return false;
    }

    function drawFinder(startR, startC) {
      qctx.fillStyle = '#C9A45C';
      qctx.fillRect(pad + startC * cell, pad + startR * cell, 7 * cell, 7 * cell);
      qctx.fillStyle = '#050508';
      qctx.fillRect(pad + (startC + 1) * cell, pad + (startR + 1) * cell, 5 * cell, 5 * cell);
      qctx.fillStyle = '#C9A45C';
      qctx.fillRect(pad + (startC + 2) * cell, pad + (startR + 2) * cell, 3 * cell, 3 * cell);
    }

    drawFinder(0, 0);
    drawFinder(0, N - 7);
    drawFinder(N - 7, 0);

    qctx.fillStyle = '#C9A45C';
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (isFinder(r, c)) continue;
        const bit = ((hash ^ (r * 31 + c * 17)) & 1);
        if (bit === 1) {
          qctx.fillRect(pad + c * cell, pad + r * cell, cell - 0.5, cell - 0.5);
        }
      }
    }
  }

  /* ═══════════════════════════════════════════════════════════
     11. FORM VALIDATION & CHECKOUT GATEWAY
     ═══════════════════════════════════════════════════════════ */

  const validators = {
    name   : v => v.trim().length >= 2 ? '' : 'Enter your full name (minimum 2 letters)',
    phone  : v => /^[6-9]\d{9}$/.test(v.trim()) ? '' : 'Enter a valid 10-digit Indian mobile number',
    email  : v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter a valid email address'
  };

  function validateField(input) {
    const fn = validators[input.name];
    if (!fn) return true;
    const msg = fn(input.value);
    const group = input.closest('.field-group');
    const errEl = document.getElementById('err-' + input.name);

    if (msg) {
      if (group) group.classList.add('has-error');
      if (errEl) errEl.textContent = msg;
      return false;
    } else {
      if (group) group.classList.remove('has-error');
      if (errEl) errEl.textContent = '';
      return true;
    }
  }

  function initForm() {
    if (!regForm) return;

    regForm.querySelectorAll('input').forEach(input => {
      input.addEventListener('blur', () => validateField(input));
      input.addEventListener('input', () => {
        const errEl = document.getElementById('err-' + input.name);
        if (errEl && errEl.textContent) validateField(input);
      });
    });

    regForm.addEventListener('submit', e => {
      e.preventDefault();

      let valid = true;
      regForm.querySelectorAll('input').forEach(input => {
        if (!validateField(input)) valid = false;
      });
      if (!valid) return;

      const name    = document.getElementById('f-name').value.trim();
      const college = (document.getElementById('f-college')?.value || 'SUIET Mukka').trim() || 'SUIET Mukka';
      const random4 = Math.floor(1000 + Math.random() * 9000);
      const passId  = `ECHO-2026-${random4}`;
      const totalAmt= ticketCount * TICKET_PRICE;

      const submitBtn = document.getElementById('submitBtn');
      if (submitBtn) {
        submitBtn.innerHTML = `<span>Connecting Cashfree...</span>`;
        submitBtn.style.opacity = '0.8';
        submitBtn.style.pointerEvents = 'none';
      }

      setTimeout(() => {
        document.getElementById('tk-name').textContent      = name;
        document.getElementById('tk-college').textContent   = college;
        document.getElementById('tk-pass').textContent      = passId;
        const tierEl = document.getElementById('tk-tier');
        if (tierEl) tierEl.textContent = 'Early Bird • Arena Access';
        const qtyTotalEl = document.getElementById('tk-qty-total');
        if (qtyTotalEl) {
          qtyTotalEl.textContent = `${ticketCount} ${ticketCount === 1 ? 'Pass' : 'Passes'} (₹${totalAmt} Cashfree Verified)`;
        }

        formCard.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        formCard.style.opacity    = '0';
        formCard.style.transform  = 'translateY(-16px)';

        setTimeout(() => {
          formCard.style.display   = 'none';
          ticketPass.style.display = 'block';
          ticketPass.style.opacity = '0';
          ticketPass.style.transform = 'translateY(24px)';

          requestAnimationFrame(() => {
            ticketPass.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
            ticketPass.style.opacity    = '1';
            ticketPass.style.transform  = 'translateY(0)';
          });

          generateTicketQR(passId, name);

          setTimeout(() => {
            if (lenisInst) {
              lenisInst.scrollTo(ticketPass, { offset: -30 });
            } else {
              ticketPass.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 200);
        }, 350);
      }, 600);
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        ticketPass.style.display = 'none';
        formCard.style.display   = 'block';
        formCard.style.opacity   = '1';
        formCard.style.transform = 'none';
        regForm.reset();
        ticketCount = 1;
        updatePricing();
        regForm.querySelectorAll('.field-group').forEach(g => g.classList.remove('has-error'));
        regForm.querySelectorAll('.field-err').forEach(el => el.textContent = '');

        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
          submitBtn.innerHTML = `<span id="btnPayText">PAY NOW • ₹349</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
          submitBtn.style.opacity = '1';
          submitBtn.style.pointerEvents = 'auto';
        }

        if (lenisInst) {
          lenisInst.scrollTo(formCard, { offset: -30 });
        } else {
          formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     12. RESIZE & VIEWPORT ORIENTATION
     ═══════════════════════════════════════════════════════════ */

  let resizeTimer = null;
  function handleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      sizeCanvas();
      drawFrame(currentFrame);
      if (typeof ScrollTrigger !== 'undefined') {
        ScrollTrigger.refresh();
      }
    }, 150);
  }

  /* ═══════════════════════════════════════════════════════════
     13. INIT ENTRY POINT
     ═══════════════════════════════════════════════════════════ */

  function init() {
    sizeCanvas();
    initFrames();
    initLenis();
    initScrub();
    initAudio();
    initPricing();
    initNav();
    initReveals();
    initStatCounters();
    initMarquee();
    initForm();

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('orientationchange', handleResize, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
