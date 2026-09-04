/* narthex/nav — header measurements and Webflow-navbar coordination.
 *
 * ROLES  (vci-nav="…")
 *   header   the sticky header. Its height is written to --header-height and
 *            its current bottom edge (as it scrolls) to --nav-offset, both on
 *            <html>, so CSS can offset anchors and sticky elements below it.
 *   dim      a full-page backdrop for the mobile menu. Gets vci-nav-dim-class
 *            while the Webflow navbar it belongs to is open; clicking it closes
 *            the menu. Webflow's navbar fires no open event — the only signal is
 *            the class it toggles on .w-nav-button, so this watches that.
 *   menu     a .w-nav to track even without a dim (for the scroll lock).
 *
 * SETTINGS (vci-nav-<setting>)
 *   height-var   CSS variable name for the header height. Default --header-height.
 *   offset-var   CSS variable name for the header's bottom edge. Default --nav-offset.
 *   dim-class    class on the dim while the menu is open. Default is-open.
 *   lock         "false" to leave the page scrollable while the menu is open.
 *
 * EVENTS  vci:nav:open / vci:nav:close on the .w-nav, detail { nav }
 * API     vci.nav.isOpen(navEl?) · measure()
 */
vci.define('nav', function (vci) {
  'use strict';
  var d = document, w = window;
  var M = 'nav';
  var root = d.documentElement;
  var header = null;

  function measureOffset() {
    if (!header) return;
    root.style.setProperty(vci.config(M, 'offset-var', '--nav-offset', header),
      Math.max(0, header.getBoundingClientRect().bottom) + 'px');
  }
  function measure() {
    if (!header) return;
    root.style.setProperty(vci.config(M, 'height-var', '--header-height', header), header.offsetHeight + 'px');
    measureOffset();
  }

  function navOf(el) {
    return el.closest('.w-nav') || d.querySelector('.w-nav');
  }
  function buttonOf(nav) { return nav ? nav.querySelector('.w-nav-button') : null; }
  function isOpen(nav) {
    nav = nav || d.querySelector('.w-nav');
    var b = buttonOf(nav);
    return !!(b && b.classList.contains('w--open'));
  }

  var tracked = [];
  function track(nav, dim) {
    if (!nav) return;
    var entry = tracked.filter(function (t) { return t.nav === nav; })[0];
    if (!entry) {
      entry = { nav: nav, dims: [], open: isOpen(nav) };
      tracked.push(entry);
      var btn = buttonOf(nav);
      if (btn) new MutationObserver(function () { sync(entry); }).observe(btn, { attributes: true, attributeFilter: ['class'] });
    }
    if (dim && entry.dims.indexOf(dim) < 0) entry.dims.push(dim);
    sync(entry, true);
  }
  function sync(entry, initial) {
    var open = isOpen(entry.nav);
    entry.dims.forEach(function (dm) {
      dm.classList.toggle(vci.config(M, 'dim-class', 'is-open', dm), open);
    });
    if (vci.bool(vci.config(M, 'lock', 'true', entry.nav), true)) {
      if (open) vci.lock.hold('nav'); else vci.lock.release('nav');
    }
    if (initial || open === entry.open) { entry.open = open; return; }
    entry.open = open;
    vci.emit(entry.nav, open ? 'nav:open' : 'nav:close', { nav: entry.nav });
  }

  d.addEventListener('click', function (e) {
    var dim = vci.closest(e.target, M, 'dim');
    if (!dim) return;
    var btn = buttonOf(navOf(dim));
    if (btn) btn.click();
  });

  vci.ready(function () {
    header = vci.all(M, 'header')[0] || null;
    if (header) {
      measure();
      if ('ResizeObserver' in w) new ResizeObserver(measure).observe(header);
      else w.addEventListener('resize', measure);
      w.addEventListener('scroll', measureOffset, { passive: true });
      w.addEventListener('resize', measureOffset);
      if (header.matches('.w-nav')) track(header);
    }
    vci.all(M, 'menu').forEach(function (n) { track(n.matches('.w-nav') ? n : navOf(n)); });
    vci.all(M, 'dim').forEach(function (dm) { track(navOf(dm), dm); });
  });

  return { isOpen: isOpen, measure: measure };
});
