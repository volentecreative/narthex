/* narthex/nav — header measurements and menu coordination.
 *
 * Two kinds of menu are supported and they behave the same from the outside:
 *
 *   Webflow navbar   the markup Webflow's Navbar element produces. It fires no
 *                    open event, so the only signal is the w--open class it
 *                    toggles on .w-nav-button — this watches that and owns
 *                    nothing.
 *   plain markup     a hamburger and a panel that are just divs (a hand-built
 *                    header, or a Webflow site that never used the Navbar
 *                    element). Give them the toggle and menu roles and narthex
 *                    owns the open class; or set vci-nav-own="false" and it
 *                    watches the class something else (an Interaction, site
 *                    code) is already toggling.
 *
 * Either way you get: the dim backdrop, the shared scroll lock, aria-expanded
 * on the toggle, Escape to close, and vci:nav:open / vci:nav:close.
 *
 * ROLES  (vci-nav="…")
 *   header   the sticky header. Its height is written to --header-height and
 *            its current bottom edge (as it scrolls) to --nav-offset, both on
 *            <html>, so CSS can offset anchors and sticky elements below it.
 *   menu     the panel that opens. A .w-nav (or anything inside one) is treated
 *            as a Webflow navbar; anything else is plain markup.
 *   toggle   the hamburger. Clicking it opens and closes the menu it is paired
 *            with. Gets aria-expanded and vci-nav-toggle-class, and is made
 *            keyboard-operable if it is not already a button or link.
 *   dim      a full-page backdrop. Gets vci-nav-dim-class while the menu it
 *            belongs to is open; clicking it closes the menu.
 *
 * Roles pair by vci-nav-key, resolved from the element or any ancestor — so one
 * key on the header wrapper covers its toggle, menu and dim. A page with a
 * single menu needs no key at all.
 *
 * SETTINGS (vci-nav-<setting>)
 *   height-var    CSS variable name for the header height. Default --header-height.
 *   offset-var    CSS variable name for the header's bottom edge. Default --nav-offset.
 *   dim-class     class on the dim while the menu is open. Default is-open.
 *   menu-class    class on the menu while it is open. Default is-open. Plain
 *                 markup only — a Webflow navbar's classes are Webflow's.
 *   toggle-class  class on the toggle while the menu is open. Default is-open.
 *   own           "false" to leave the menu class to something else and only
 *                 watch it. Plain markup only. Default true.
 *   link-close    "false" to leave the menu open when a link inside it is
 *                 clicked. Default true.
 *   esc           "false" to leave Escape alone. Default true.
 *   lock          "false" to leave the page scrollable while the menu is open.
 *
 * EVENTS  vci:nav:open / vci:nav:close on the menu, detail { nav, menu }
 * API     vci.nav.isOpen(el?) · open(el?) · close(el?) · toggle(el?) · measure()
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

  /* ---------- entries ---------- */
  // One entry per menu. Webflow entries read their open state from the
  // navbar button's w--open; plain ones from the menu's own open class.
  var tracked = [];

  function wnavOf(el) { return el && el.closest ? el.closest('.w-nav') : null; }
  function buttonOf(nav) { return nav ? nav.querySelector('.w-nav-button') : null; }
  function menuClass(entry) { return vci.config(M, 'menu-class', 'is-open', entry.menu); }

  function readOpen(entry) {
    if (entry.webflow) {
      var b = buttonOf(entry.nav);
      return !!(b && b.classList.contains('w--open'));
    }
    return entry.menu.classList.contains(menuClass(entry));
  }

  function entryFor(el) {
    if (!el) return tracked[0] || null;
    for (var i = 0; i < tracked.length; i++) {
      var e = tracked[i];
      if (e.nav === el || e.menu === el || e.nav.contains(el) || e.menu.contains(el)) return e;
      if (e.toggles.indexOf(el) >= 0 || e.dims.indexOf(el) >= 0) return e;
    }
    return null;
  }

  function add(nav, menu, webflow) {
    var entry = null;
    for (var i = 0; i < tracked.length; i++) if (tracked[i].nav === nav) entry = tracked[i];
    if (entry) return entry;
    entry = { nav: nav, menu: menu || nav, webflow: !!webflow, toggles: [], dims: [], open: false };
    tracked.push(entry);
    entry.open = readOpen(entry);

    var watched = webflow ? buttonOf(nav) : entry.menu;
    if (watched) {
      new MutationObserver(function () { sync(entry); })
        .observe(watched, { attributes: true, attributeFilter: ['class'] });
    }
    return entry;
  }

  function sync(entry) {
    var open = readOpen(entry);
    entry.dims.forEach(function (dm) {
      dm.classList.toggle(vci.config(M, 'dim-class', 'is-open', dm), open);
    });
    entry.toggles.forEach(function (t) {
      t.classList.toggle(vci.config(M, 'toggle-class', 'is-open', t), open);
      t.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    if (vci.bool(vci.config(M, 'lock', 'true', entry.nav), true)) {
      if (open) vci.lock.hold('nav:' + tracked.indexOf(entry));
      else vci.lock.release('nav:' + tracked.indexOf(entry));
    }
    if (open === entry.open) return;
    entry.open = open;
    vci.emit(entry.menu, open ? 'nav:open' : 'nav:close', { nav: entry.nav, menu: entry.menu });
  }

  function setOpen(entry, open) {
    if (!entry || readOpen(entry) === open) return;
    if (entry.webflow) {
      var b = buttonOf(entry.nav);
      if (b) b.click();
      return;
    }
    if (vci.bool(vci.config(M, 'own', 'true', entry.menu), true)) {
      entry.menu.classList.toggle(menuClass(entry), open);
    }
    sync(entry);
  }

  /* ---------- public ---------- */
  function isOpen(el) {
    var e = entryFor(el);
    return e ? readOpen(e) : false;
  }
  function open(el) { setOpen(entryFor(el), true); }
  function close(el) { setOpen(entryFor(el), false); }
  function toggle(el) {
    var e = entryFor(el);
    if (e) setOpen(e, !readOpen(e));
  }

  /* ---------- events ---------- */
  d.addEventListener('click', function (e) {
    var t = vci.closest(e.target, M, 'toggle');
    if (t) {
      var te = entryFor(t);
      if (te) {
        // A Webflow navbar button is its own toggle — let Webflow handle it.
        if (!(te.webflow && buttonOf(te.nav) === t)) e.preventDefault();
        setOpen(te, !readOpen(te));
      }
      return;
    }
    var dim = vci.closest(e.target, M, 'dim');
    if (dim) { close(dim); return; }

    var link = e.target.closest && e.target.closest('a[href]');
    if (!link) return;
    for (var i = 0; i < tracked.length; i++) {
      var entry = tracked[i];
      if (entry.webflow || !entry.menu.contains(link) || !readOpen(entry)) continue;
      if (vci.bool(vci.config(M, 'link-close', 'true', entry.menu), true)) setOpen(entry, false);
    }
  });

  d.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      var t = vci.closest(e.target, M, 'toggle');
      if (t && !t.matches('button, a[href]')) {
        e.preventDefault();
        toggle(t);
      }
      return;
    }
    if (e.key !== 'Escape') return;
    tracked.forEach(function (entry) {
      if (!readOpen(entry)) return;
      if (!vci.bool(vci.config(M, 'esc', 'true', entry.menu), true)) return;
      setOpen(entry, false);
      var t = entry.toggles[0];
      if (t && t.focus) t.focus();
    });
  });

  /* ---------- boot ---------- */
  vci.ready(function () {
    header = vci.all(M, 'header')[0] || null;
    if (header) {
      measure();
      if ('ResizeObserver' in w) new ResizeObserver(measure).observe(header);
      else w.addEventListener('resize', measure);
      w.addEventListener('scroll', measureOffset, { passive: true });
      w.addEventListener('resize', measureOffset);
    }

    // Group the roles by key, so one header's toggle/menu/dim find each other.
    var groups = {}, order = [];
    function bucket(el) {
      var k = vci.config(M, 'key', '', el) || '';
      if (!groups[k]) { groups[k] = { menu: null, toggles: [], dims: [] }; order.push(k); }
      return groups[k];
    }
    vci.all(M, 'menu').forEach(function (n) { var g = bucket(n); if (!g.menu) g.menu = n; });
    vci.all(M, 'toggle').forEach(function (n) {
      // A hamburger built from divs is not focusable and announces nothing.
      if (!n.matches('button, a[href], [tabindex]')) {
        n.setAttribute('role', 'button');
        n.setAttribute('tabindex', '0');
      }
      bucket(n).toggles.push(n);
    });
    vci.all(M, 'dim').forEach(function (n) { bucket(n).dims.push(n); });

    // A header that is itself a Webflow navbar is tracked even with no roles on it.
    if (header && header.matches('.w-nav')) add(header, header, true);

    order.forEach(function (k) {
      var g = groups[k];
      var menu = g.menu;
      // With no menu role, fall back to the Webflow navbar nearest the dim or
      // toggle — the shape the dim role has always had.
      var wnav = menu ? (menu.matches('.w-nav') ? menu : wnavOf(menu)) : null;
      if (!menu) {
        var anchor = g.dims[0] || g.toggles[0];
        wnav = wnavOf(anchor) || d.querySelector('.w-nav');
        if (!wnav) return;
      }
      var entry = wnav ? add(wnav, wnav, true) : add(menu, menu, false);
      g.toggles.forEach(function (t) { if (entry.toggles.indexOf(t) < 0) entry.toggles.push(t); });
      g.dims.forEach(function (dm) { if (entry.dims.indexOf(dm) < 0) entry.dims.push(dm); });
    });

    tracked.forEach(sync);
  });

  return { isOpen: isOpen, open: open, close: close, toggle: toggle, measure: measure };
});
