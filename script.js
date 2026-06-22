/* ============================================================
   Clean.my — interactions
   ============================================================ */
(function () {
  'use strict';

  /* ---- Basic anti-clickjacking fallback (real protection = frame-ancestors header at the edge) ---- */
  try { if (window.top !== window.self) window.top.location = window.location.href; } catch (e) {}

  /* ---- Sticky nav scrolled state ---- */
  const nav = document.getElementById('nav');
  const onScroll = () => {
    if (window.scrollY > 30) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Mobile menu ---- */
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  const closeMenu = () => {
    links.classList.remove('open');
    toggle.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  };
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  });
  links.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMenu));

  /* ---- Scroll reveal ---- */
  const revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const delay = entry.target.getAttribute('data-delay') || 0;
          entry.target.style.transitionDelay = delay + 'ms';
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  /* ---- Animated counters ---- */
  const counters = document.querySelectorAll('[data-count]');
  const animateCount = (el) => {
    const target = parseFloat(el.getAttribute('data-count'));
    const decimals = parseInt(el.getAttribute('data-decimals') || '0', 10);
    const suffix = el.getAttribute('data-suffix') || '';
    const duration = 1600;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      const val = target * eased;
      el.textContent = val.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suffix;
      if (p < 1) requestAnimationFrame(tick);
      else el.textContent = target.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + suffix;
    };
    requestAnimationFrame(tick);
  };
  if ('IntersectionObserver' in window) {
    const co = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { animateCount(entry.target); co.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => co.observe(c));
  } else {
    counters.forEach((c) => animateCount(c));
  }

  /* ---- Quote form (demo handler) ---- */
  const form = document.getElementById('quoteForm');
  const note = document.getElementById('formNote');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      // Honeypot: if the hidden field has content, it's almost certainly a bot — drop silently.
      const hp = form.querySelector('[name="company_url"]');
      if (hp && hp.value.trim() !== '') { form.reset(); return; }
      if (!form.checkValidity()) { form.reportValidity(); return; }
      note.hidden = false;
      form.querySelector('button[type="submit"]').textContent = 'Request received ✓';
      setTimeout(() => { note.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60);
      form.reset();
    });
  }

  /* ---- Google Places address autocomplete ----
     Browser key — it is public by nature; it MUST be locked down in Google Cloud
     Console with an HTTP-referrer restriction (clean.my) + Places API restriction
     + a billing budget. Loaded lazily the first time the modal is opened. */
  const MAPS_API_KEY = 'AIzaSyDwC15A3AO67RoB6_gUka69IjW7PFvgkxA';

  // Returning-customer details, remembered locally in the browser (no backend)
  const QUOTE_KEY = 'cleanmy_quote_v1';
  const loadSavedQuote = () => { try { return JSON.parse(localStorage.getItem(QUOTE_KEY) || 'null'); } catch (e) { return null; } };
  const savedAddress = () => { const q = loadSavedQuote(); return (q && q.address) || ''; };

  let mapsRequested = false;
  const loadPlaces = () => {
    if (mapsRequested) return;
    mapsRequested = true;
    const s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + MAPS_API_KEY +
            '&libraries=places&loading=async&callback=__initWaAutocomplete';
    s.async = true;
    document.head.appendChild(s);
  };
  window.__initWaAutocomplete = function () {
    const input = document.getElementById('waAddress');
    const Places = window.google && google.maps && google.maps.places;
    // New Places API (legacy Autocomplete is unavailable to new Google customers)
    if (!input || !Places || !Places.AutocompleteSuggestion) return;
    if (input.dataset.acReady) return;            // guard against double init
    input.dataset.acReady = '1';

    // Build a custom dropdown around the input, styled to match the form
    const wrap = document.createElement('div');
    wrap.className = 'ac-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    const list = document.createElement('ul');
    list.className = 'ac-list';
    list.hidden = true;
    wrap.appendChild(list);

    let token = new Places.AutocompleteSessionToken();
    let timer = null;
    let active = -1;

    const hide = () => { list.hidden = true; list.innerHTML = ''; active = -1; };
    const info = (msg) => {                         // visible diagnostic / fallback
      list.innerHTML = '';
      const li = document.createElement('li');
      li.className = 'ac-item ac-item--info';
      li.textContent = msg;
      list.appendChild(li);
      list.hidden = false;
    };
    const choose = (text) => {
      input.value = text;
      hide();
      token = new Places.AutocompleteSessionToken(); // fresh session after each pick
    };
    const makeItem = (text, saved) => {
      const li = document.createElement('li');
      li.className = saved ? 'ac-item ac-item--saved' : 'ac-item';
      li.dataset.value = text;
      if (saved) {
        const tag = document.createElement('span');
        tag.className = 'ac-saved-tag';
        tag.textContent = 'Saved';
        li.appendChild(tag);
      }
      li.appendChild(document.createTextNode(text));
      li.addEventListener('mousedown', (e) => { e.preventDefault(); choose(text); });
      return li;
    };
    const showList = (suggestions) => {
      list.innerHTML = '';
      active = -1;
      const saved = savedAddress();
      const current = input.value.trim();
      let count = 0;
      // Saved address pinned to the top as the default — unless it's already typed
      if (saved && saved !== current) { list.appendChild(makeItem(saved, true)); count++; }
      (suggestions || []).filter((s) => s.placePrediction)
        .map((s) => s.placePrediction.text.toString())
        .filter((t) => t !== saved)
        .slice(0, 5)
        .forEach((t) => { list.appendChild(makeItem(t, false)); count++; });
      list.hidden = count === 0;
    };
    const search = (v) => {
      clearTimeout(timer);
      if (v.length < 3) { showList([]); return; }   // still offer the saved address
      timer = setTimeout(async () => {
        try {
          const res = await Places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: v, sessionToken: token, includedRegionCodes: ['my']
          });
          showList(res.suggestions);
        } catch (err) {
          console.warn('Places autocomplete error:', err);
          info('Lookup error: ' + (err && err.message ? err.message : String(err)));
        }
      }, 260);
    };

    input.addEventListener('focus', () => showList([]));   // offer the saved address on focus
    input.addEventListener('input', () => search(input.value.trim()));
    input.addEventListener('keydown', (e) => {
      const items = list.querySelectorAll('.ac-item:not(.ac-item--info)');
      if (list.hidden || !items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, items.length - 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); }
      else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0) choose(items[active].dataset.value); return; }
      else if (e.key === 'Escape') { hide(); return; }
      else return;
      items.forEach((it, i) => it.classList.toggle('active', i === active));
    });
    input.addEventListener('blur', () => setTimeout(hide, 150));

    // If text was typed before Places finished loading, search it now
    if (input.value.trim().length >= 3) search(input.value.trim());
  };

  /* ---- WhatsApp quote modal ---- */
  const fab = document.getElementById('fabQuote');
  const modal = document.getElementById('quoteModal');
  if (fab && modal) {
    const waForm = document.getElementById('waForm');
    const closeBtn = document.getElementById('qmClose');
    const addrInput = document.getElementById('waAddress');
    if (addrInput) addrInput.addEventListener('focus', loadPlaces); // preload on field focus
    // Preload Places on the visitor's first interaction so it's always ready before the modal opens
    const preloadPlaces = () => loadPlaces();
    ['pointerdown', 'touchstart', 'scroll', 'keydown'].forEach((ev) =>
      window.addEventListener(ev, preloadPlaces, { once: true, passive: true }));
    let lastFocus = null;

    const setIfEmpty = (id, v) => { const el = document.getElementById(id); if (el && !el.value && v) el.value = v; };
    const openModal = () => {
      loadPlaces();
      const saved = loadSavedQuote();   // prefill returning customers
      if (saved) {
        setIfEmpty('waName', saved.name);
        setIfEmpty('waPhone', saved.phone);
        setIfEmpty('waAddress', saved.address);
        setIfEmpty('waEmail', saved.email);
      }
      lastFocus = document.activeElement;
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      const first = modal.querySelector('input, textarea');
      if (first) setTimeout(() => first.focus(), 60);
    };
    const closeModal = () => {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };

    fab.addEventListener('click', openModal);
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });

    waForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!waForm.checkValidity()) { waForm.reportValidity(); return; }
      const number = (waForm.getAttribute('data-wa') || '').replace(/[^0-9]/g, '');
      const val = (id) => (document.getElementById(id).value || '').trim();
      const name = val('waName');
      const phone = val('waPhone');
      const address = val('waAddress');
      const email = val('waEmail');
      const enquiry = val('waMsg');

      // Remember details for next time (saved address shows pinned on top)
      try { localStorage.setItem(QUOTE_KEY, JSON.stringify({ name, phone, address, email })); } catch (e) {}

      let msg = "Hi Clean.my! I'd like a cleaning quote.\n\n";
      msg += 'Name: ' + name + '\n';
      msg += 'Phone: ' + phone + '\n';
      msg += 'Address: ' + address + '\n';
      if (email) msg += 'Email: ' + email + '\n';
      msg += '\nEnquiry:\n' + enquiry;

      const url = 'https://wa.me/' + number + '?text=' + encodeURIComponent(msg);
      window.open(url, '_blank', 'noopener');
      closeModal();
    });
  }

  /* ---- Current year ---- */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
