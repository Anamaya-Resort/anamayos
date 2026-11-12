/*
 * AnamayOS "Upcoming retreats" cards: drop-in widget for anamaya.com (or any site).
 *
 * Usage:
 *   <div class="ao-upcoming-retreats" data-limit="3" data-min-days="7"
 *        data-heading="Upcoming retreat weeks"></div>
 *   <script src="https://ao.anamaya.com/embed/upcoming-retreats.js" defer></script>
 *
 * Reads /api/public/upcoming-retreats (next retreats 7+ days out that still
 * have space). Loads fresh in the visitor's browser, so page caches never show
 * stale retreats. If the feed fails or is empty, the block hides itself.
 *
 * Styling: every colour/size is a --aour-* token in TOKENS below; a host page
 * can override any of them on .ao-upcoming-retreats.
 */
(function () {
  var script = document.currentScript;
  var API = (script && script.getAttribute('data-api')) ||
    (script ? new URL(script.src).origin : 'https://ao.anamaya.com') + '/api/public/upcoming-retreats';

  var TOKENS =
    '--aour-ink:#444444;--aour-ink-soft:#6b6b6b;--aour-accent:#8f993e;' +
    '--aour-teal:#2c4842;--aour-btn:#ae564b;--aour-btn-hover:#8f4237;--aour-card:#ffffff;' +
    '--aour-line:#e6e2d6;--aour-skeleton:#f1eee6;--aour-radius:6px;--aour-gap:22px;' +
    '--aour-head-font:Oswald,"Arial Narrow",sans-serif;--aour-body-font:Lato,Helvetica,Arial,sans-serif;';

  var CSS =
    '.ao-upcoming-retreats{' + TOKENS + 'margin:36px 0 40px;font-family:var(--aour-body-font);color:var(--aour-ink)}' +
    '.ao-upcoming-retreats .aour-heading{font-family:var(--aour-head-font);text-transform:uppercase;letter-spacing:.06em;font-size:22px;font-weight:500;color:var(--aour-teal);margin:0 0 18px!important;text-wrap:balance}' +
    '.aour-grid{display:grid;gap:var(--aour-gap);grid-template-columns:1fr}' +
    '@media (min-width:700px){.aour-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}' +
    '.aour-card{display:flex;flex-direction:column;background:var(--aour-card);border:1px solid var(--aour-line);border-radius:var(--aour-radius);overflow:hidden;text-decoration:none!important;color:inherit!important;transition:transform .2s,box-shadow .2s}' +
    '.aour-card:hover{transform:translateY(-2px);box-shadow:0 10px 24px rgba(44,72,66,.14)}' +
    '.aour-card:focus-visible{outline:2px solid var(--aour-accent);outline-offset:3px}' +
    '.aour-img{display:block;width:100%;aspect-ratio:3/2;object-fit:cover;background:var(--aour-skeleton);margin:0!important;border-radius:0!important}' +
    '.aour-body{display:flex;flex-direction:column;gap:6px;padding:14px 16px 16px;flex:1}' +
    '.aour-date{font-family:var(--aour-head-font);text-transform:uppercase;letter-spacing:.08em;font-size:13px;color:var(--aour-accent);font-variant-numeric:tabular-nums}' +
    '.ao-upcoming-retreats .aour-title{font-size:19px;line-height:1.3;margin:0!important;padding:0}' +
    '.ao-upcoming-retreats .aour-leader{font-size:15px;color:var(--aour-ink-soft);margin:0!important}' +
    '.ao-upcoming-retreats .aour-rooms{font-size:15px;line-height:1.45;color:var(--aour-ink);margin:6px 0 0!important}' +
    '.aour-foot{margin-top:auto;padding-top:10px;display:flex;align-items:center;justify-content:space-between;gap:10px}' +
    '.aour-price{font-size:14px;color:var(--aour-ink-soft)}.aour-price b{color:var(--aour-ink);font-weight:700}' +
    '.aour-btn{font-family:var(--aour-head-font);text-transform:uppercase;letter-spacing:.08em;font-size:13px;background:var(--aour-btn);color:#fff;padding:7px 12px;border-radius:4px;white-space:nowrap;transition:background .2s}' +
    '.aour-card:hover .aour-btn{background:var(--aour-btn-hover)}' +
    '.aour-skel{min-height:330px;background:var(--aour-skeleton);border-radius:var(--aour-radius)}' +
    '@media (prefers-reduced-motion:reduce){.aour-card{transition:none}.aour-card:hover{transform:none}}';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function dateRange(a, b) {
    var d = function (s) { return new Date(s + 'T12:00:00Z'); };
    var o = { month: 'short', day: 'numeric', timeZone: 'UTC' };
    var s = d(a), e = b ? d(b) : null;
    var start = s.toLocaleDateString('en-US', o);
    if (!e) return start + ', ' + s.getUTCFullYear();
    var endOpts = e.getUTCMonth() === s.getUTCMonth() ? { day: 'numeric', timeZone: 'UTC' } : o;
    var y = s.getUTCFullYear() === e.getUTCFullYear() ? '' : ', ' + s.getUTCFullYear();
    return start + y + ' – ' + e.toLocaleDateString('en-US', endOpts) + ', ' + e.getUTCFullYear();
  }

  function roomsLine(r) {
    if (!r.rooms_open || !r.rooms_total) return '';
    var n = r.rooms_open.length;
    if (n === r.rooms_total) return 'All room types still open';
    if (n <= 2) return 'Still open: ' + r.rooms_open.map(function (x) { return x.name; }).join(' and ');
    return n + ' of ' + r.rooms_total + ' room types still open';
  }

  function money(n) { return '$' + Math.round(n).toLocaleString('en-US'); }

  function card(r) {
    var href = r.url || r.booking_url || '#';
    var external = !/^https?:\/\/(www\.)?anamaya\.com\//.test(href);
    var rooms = roomsLine(r);
    return '<a class="aour-card" href="' + esc(href) + '"' + (external ? ' target="_blank" rel="noopener"' : '') + '>' +
      (r.image ? '<img class="aour-img" src="' + esc(r.image) + '" alt="' + esc(r.title) + '" decoding="async">' : '<div class="aour-img"></div>') +
      '<div class="aour-body">' +
      '<div class="aour-date">' + esc(dateRange(r.start_date, r.end_date)) + '</div>' +
      '<h3 class="aour-title">' + esc(r.title) + '</h3>' +
      (r.leader ? '<p class="aour-leader">with ' + esc(r.leader) + '</p>' : '') +
      (rooms ? '<p class="aour-rooms">' + esc(rooms) + '</p>' : '') +
      '<div class="aour-foot"><span class="aour-price">' + (r.from_price ? 'From <b>' + money(r.from_price) + '</b>' : '') + '</span>' +
      '<span class="aour-btn">View retreat</span></div>' +
      '</div></a>';
  }

  function mount(el) {
    if (el.getAttribute('data-aour-mounted')) return;
    el.setAttribute('data-aour-mounted', '1');
    var limit = parseInt(el.getAttribute('data-limit') || '3', 10);
    var minDays = parseInt(el.getAttribute('data-min-days') || '7', 10);
    var heading = el.getAttribute('data-heading');
    var head = heading ? '<h2 class="aour-heading">' + esc(heading) + '</h2>' : '';
    var skel = '';
    for (var i = 0; i < limit; i++) skel += '<div class="aour-skel"></div>';
    el.innerHTML = head + '<div class="aour-grid">' + skel + '</div>';

    fetch(API + '?limit=' + limit + '&min_days=' + minDays, { credentials: 'omit' })
      .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(function (data) {
        var list = (data && data.retreats) || [];
        if (!list.length) { el.style.display = 'none'; return; }
        el.innerHTML = head + '<div class="aour-grid">' + list.map(card).join('') + '</div>';
      })
      .catch(function () { el.style.display = 'none'; });
  }

  function init() {
    if (!document.getElementById('aour-style')) {
      var st = document.createElement('style');
      st.id = 'aour-style';
      st.textContent = CSS;
      document.head.appendChild(st);
    }
    var els = document.querySelectorAll('.ao-upcoming-retreats');
    for (var i = 0; i < els.length; i++) mount(els[i]);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
