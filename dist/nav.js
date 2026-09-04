/*! narthex v0.1.1 — nav — https://github.com/volentecreative/narthex
 * Attribute-driven utilities for Webflow. MIT. */
/* narthex core — shared plumbing every module uses.
 *
 * Global namespace: window.vci. It is safe to load more than one dist file on a
 * page (say modal.js and accordion.js): the core installs once and each module
 * registers once, whichever file gets there first.
 *
 * Attribute convention — see README:
 *   vci-<module>="<role>"             marks what an element IS to that module
 *   vci-<module>-<setting>="<value>"  configures behaviour; read from the
 *                                     element, then its ancestors (so a setting
 *                                     can sit on a wrapper or on <html>), then
 *                                     window.vci.settings.<module>.<setting>,
 *                                     then the <script> tag that loaded us.
 */
(function (w, d) {
  'use strict';
  var vci = w.vci = w.vci || {};
  if (vci.__core) return;
  vci.__core = true;
  vci.version = '0.1.1';

  // Set window.vci = { prefix: 'acme' } BEFORE the script loads to rebrand
  // every attribute. Everything below reads P rather than the literal.
  var P = vci.prefix = vci.prefix || 'vci';
  vci.settings = vci.settings || {};
  vci.modules = {};

  var scriptEl = d.currentScript || null;

  /* ---------- attribute helpers ---------- */
  vci.attrName = function (name) { return P + '-' + name; };
  vci.attr = function (el, name) { return el && el.getAttribute ? el.getAttribute(P + '-' + name) : null; };
  vci.has = function (el, name) { return !!(el && el.hasAttribute && el.hasAttribute(P + '-' + name)); };
  vci.sel = function (module, role) {
    var a = '[' + P + '-' + module;
    return role == null ? a + ']' : a + '="' + role + '"]';
  };
  vci.all = function (module, role, root) {
    return Array.prototype.slice.call((root || d).querySelectorAll(vci.sel(module, role)));
  };
  vci.closest = function (el, module, role) {
    return el && el.closest ? el.closest(vci.sel(module, role)) : null;
  };
  vci.role = function (el, module) { return vci.attr(el, module); };

  /* ---------- settings ---------- */
  // config('modal', 'class', 'is-visible', el)
  vci.config = function (module, setting, fallback, el) {
    var name = P + '-' + module + '-' + setting;
    var v = null;
    if (el && el.closest) {
      var holder = el.closest('[' + name + ']');
      if (holder) v = holder.getAttribute(name);
    }
    if (v == null) {
      var s = vci.settings[module];
      if (s && s[setting] != null) v = s[setting];
    }
    if (v == null) {
      var tag = d.querySelector('script[' + name + ']');
      if (tag) v = tag.getAttribute(name);
    }
    return v == null ? fallback : v;
  };
  vci.bool = function (v, fallback) {
    if (v == null) return !!fallback;
    if (typeof v === 'boolean') return v;
    v = String(v).trim().toLowerCase();
    if (v === '' || v === 'true' || v === '1' || v === 'yes' || v === 'on') return true;
    if (v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
    return !!fallback;
  };
  vci.num = function (v, fallback) {
    var n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  };
  vci.list = function (v) {
    if (v == null) return [];
    return String(v).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  };

  /* ---------- lifecycle ---------- */
  vci.ready = function (fn) {
    if (d.readyState !== 'loading') fn();
    else d.addEventListener('DOMContentLoaded', fn, { once: true });
  };
  vci.emit = function (el, name, detail, cancelable) {
    var ev = new CustomEvent(P + ':' + name, { bubbles: true, cancelable: !!cancelable, detail: detail || {} });
    (el || d).dispatchEvent(ev);
    return ev;
  };
  vci.log = function () {
    if (!vci.bool(vci.config('debug', 'log', 'false'), false)) return;
    var a = Array.prototype.slice.call(arguments);
    a.unshift('[' + P + ']');
    (w.console && w.console.log).apply(w.console, a);
  };
  vci.warn = function () {
    var a = Array.prototype.slice.call(arguments);
    a.unshift('[' + P + ']');
    (w.console && w.console.warn).apply(w.console, a);
  };

  // One stylesheet per key, injected once. Modules use it for the small
  // amount of presentation they own (state-driven, never decorative).
  var styles = {};
  vci.css = function (key, text) {
    if (styles[key]) return styles[key];
    var s = d.createElement('style');
    s.setAttribute(P + '-style', key);
    s.textContent = text;
    (d.head || d.documentElement).appendChild(s);
    styles[key] = s;
    return s;
  };

  /* ---------- scroll lock (shared by modal + nav) ---------- */
  // Several things can want the page locked at once (a drawer over an open
  // nav). Each holds by id; the body unlocks when the last one lets go.
  var holds = {};
  function applyLock() {
    var active = Object.keys(holds).length > 0;
    var b = d.body;
    if (!b) return;
    if (active) {
      if (b.style.overflow === 'hidden') return;
      var sw = w.innerWidth - d.documentElement.clientWidth;
      b.style.overflow = 'hidden';
      if (sw > 0) b.style.paddingRight = sw + 'px';
    } else {
      b.style.overflow = '';
      b.style.paddingRight = '';
    }
  }
  vci.lock = {
    hold: function (id) { holds[id] = true; applyLock(); },
    release: function (id) { delete holds[id]; applyLock(); },
    active: function () { return Object.keys(holds).length > 0; },
    ids: function () { return Object.keys(holds); }
  };

  /* ---------- focus helpers ---------- */
  vci.FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  vci.focusables = function (el) {
    return Array.prototype.filter.call(el.querySelectorAll(vci.FOCUSABLE), function (n) {
      return n.offsetWidth || n.offsetHeight || n.getClientRects().length;
    });
  };

  /* ---------- module registry ---------- */
  // define('modal', function (vci) { ...; return api; })
  vci.define = function (name, factory) {
    if (vci.modules[name]) return vci.modules[name];
    var api = factory(vci) || {};
    api.name = name;
    vci.modules[name] = api;
    if (!vci[name]) vci[name] = api;
    return api;
  };

  vci.script = scriptEl;
})(window, document);

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
