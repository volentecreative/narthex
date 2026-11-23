/*! narthex v0.6.0 — tooltip — https://github.com/volentecreative/narthex
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
  vci.version = '0.6.0';

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
  //
  // overflow:hidden on <body> is the lock on every browser but iOS Safari,
  // which ignores it: a finger on an open sheet still pans the page behind
  // it, and overscroll-behavior is not reliably honoured either, so a panel
  // whose body has nothing to scroll chains every touch straight through to
  // the page. So each hold names the element a finger MAY scroll inside
  // (the dialog, the drawer, the menu), and while any hold is active a
  // touchmove is allowed only over something inside one of those regions
  // that genuinely overflows, and not past its edges (top pulling down and
  // bottom pushing up are what chain to the page). Everything else is
  // prevented. Non-passive by necessity: a passive listener's
  // preventDefault is a no-op.
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
  function regionOf(node) {
    var ids = Object.keys(holds);
    for (var i = 0; i < ids.length; i++) {
      var r = holds[ids[i]];
      if (r && r.nodeType === 1 && r.contains(node)) return r;
    }
    return null;
  }
  function scrollableWithin(node, region) {
    for (var el = node; el; el = el.parentNode) {
      if (el.nodeType === 1 && el.scrollHeight > el.clientHeight + 1) {
        var oy = getComputedStyle(el).overflowY;
        if (oy === 'auto' || oy === 'scroll') return el;
      }
      if (el === region) return null;
    }
    return null;
  }
  var touchY = null;
  d.addEventListener('touchstart', function (e) {
    touchY = (vci.lock.active() && e.touches && e.touches.length === 1) ? e.touches[0].clientY : null;
  }, { passive: true });
  d.addEventListener('touchmove', function (e) {
    if (!vci.lock.active()) return;
    var region = regionOf(e.target);
    if (!region) { e.preventDefault(); return; }
    var sc = scrollableWithin(e.target, region);
    if (!sc) { e.preventDefault(); return; }
    if (!e.touches || e.touches.length !== 1 || touchY === null) return;
    var y = e.touches[0].clientY;
    var dy = y - touchY; // finger moving down = content scrolling up
    touchY = y;
    var atTop = sc.scrollTop <= 0;
    var atBottom = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
    if ((dy > 0 && atTop) || (dy < 0 && atBottom)) e.preventDefault();
  }, { passive: false });
  vci.lock = {
    // hold(id, region): region is the element a touch may scroll inside
    // while this hold is active. Omit it and nothing scrolls by touch.
    hold: function (id, region) { holds[id] = region || true; applyLock(); },
    release: function (id) { delete holds[id]; applyLock(); },
    active: function () { return Object.keys(holds).length > 0; },
    ids: function () { return Object.keys(holds); },
    // Would this touch be allowed to scroll? Exposed for tests and for site
    // code that wants to reason about the lock without dispatching touches.
    allows: function (node) { return !vci.lock.active() || !!(regionOf(node) && scrollableWithin(node, regionOf(node))); }
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

/* narthex/tooltip — a hover/focus label for icon buttons and anything else.
 *
 * MARK   vci-tooltip="Copy transcript"   the text to show. Left empty
 *        (vci-tooltip=""), the element's aria-label is used instead, read at
 *        show time — so a Play/Pause button's tooltip follows its label.
 *        (The one module whose main attribute carries text rather than a
 *        role: a tooltip has nothing else to say.)
 *
 * One shared tooltip element is appended to <body> and positioned (fixed) next
 * to the element: above it, flipping below when there is no room, kept inside
 * the viewport. It shows after a short delay for a mouse, at once for keyboard
 * focus, never for touch, and hides on Escape, scroll, click and pointer-out.
 * Listeners are delegated, so elements added later (a CMS list, script-built
 * UI) need nothing. While shown, an element whose own accessible name differs
 * from the text gets aria-describedby pointing at the tooltip.
 *
 * SETTINGS (vci-tooltip-<setting>, on the element or any ancestor / <script> / vci.settings.tooltip)
 *   class      class on the tooltip element, for the site to style. Default tooltip.
 *   placement  top (default) · bottom · left · right. Flips when it would leave the viewport.
 *   offset     gap between element and tooltip, in px. Default 8.
 *   delay      hover delay in ms. Default 300. Focus shows at once.
 *   css        "false" to skip the built-in fade (the tooltip is still positioned).
 *
 * The tooltip carries vci-tooltip-state="open" while shown and
 * vci-tooltip-placement="<side>" for the side it ended up on, so site CSS can
 * draw an arrow or vary the motion by side.
 *
 * EVENTS  vci:tooltip:show / vci:tooltip:hide on the element, detail { el, text }
 * API     vci.tooltip.show(el) · hide() · current()
 */
vci.define('tooltip', function (vci) {
  'use strict';
  var w = window, d = document;
  var M = 'tooltip';
  var A = vci.attrName;
  var tip = null, owner = null, timer = null, described = false;

  function textOf(el) {
    var t = (vci.attr(el, M) || '').trim();
    return t || (el.getAttribute('aria-label') || '').trim();
  }

  function ensure(el) {
    if (!tip) {
      tip = d.createElement('div');
      tip.id = A('tooltip') + '-' + Math.random().toString(36).slice(2, 8);
      tip.setAttribute('role', 'tooltip');
      tip.setAttribute(A('tooltip-el'), '');
      d.body.appendChild(tip);
      var css = '[' + A('tooltip-el') + ']{position:fixed;top:0;left:0;z-index:2147483000;pointer-events:none;visibility:hidden}' +
        '[' + A('tooltip-el') + '][' + A('tooltip-state') + '="open"]{visibility:visible}';
      if (vci.bool(vci.config(M, 'css', 'true', el), true)) {
        css += '[' + A('tooltip-el') + ']{opacity:0;transition:opacity .12s ease,visibility 0s linear .12s}' +
          '[' + A('tooltip-el') + '][' + A('tooltip-state') + '="open"]{opacity:1;transition:opacity .12s ease}';
      }
      vci.css('tooltip', css);
    }
    tip.className = vci.config(M, 'class', 'tooltip', el);
    return tip;
  }

  var FLIP = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
  function place(el) {
    var gap = vci.num(vci.config(M, 'offset', '8', el), 8);
    var want = vci.config(M, 'placement', 'top', el);
    if (!FLIP[want]) want = 'top';
    var r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
    var vw = d.documentElement.clientWidth, vh = d.documentElement.clientHeight;
    function fits(side) {
      if (side === 'top') return r.top - gap - th >= 0;
      if (side === 'bottom') return r.bottom + gap + th <= vh;
      if (side === 'left') return r.left - gap - tw >= 0;
      return r.right + gap + tw <= vw;
    }
    var side = fits(want) || !fits(FLIP[want]) ? want : FLIP[want];
    var x, y;
    if (side === 'top' || side === 'bottom') {
      x = r.left + r.width / 2 - tw / 2;
      y = side === 'top' ? r.top - gap - th : r.bottom + gap;
    } else {
      x = side === 'left' ? r.left - gap - tw : r.right + gap;
      y = r.top + r.height / 2 - th / 2;
    }
    x = Math.max(4, Math.min(x, vw - tw - 4));
    y = Math.max(4, Math.min(y, vh - th - 4));
    tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
    tip.setAttribute(A('tooltip-placement'), side);
  }

  function show(el) {
    clearTimeout(timer);
    var text = textOf(el);
    if (!text) return hide();
    if (owner && owner !== el) hide();
    ensure(el);
    tip.textContent = text;
    owner = el;
    place(el);
    tip.setAttribute(A('tooltip-state'), 'open');
    described = text !== (el.getAttribute('aria-label') || '').trim() && text !== (el.textContent || '').trim();
    if (described) el.setAttribute('aria-describedby', tip.id);
    vci.emit(el, 'tooltip:show', { el: el, text: text });
  }

  function hide() {
    clearTimeout(timer);
    if (!owner) return;
    var el = owner;
    owner = null;
    if (tip) tip.removeAttribute(A('tooltip-state'));
    if (described && el.getAttribute('aria-describedby') === (tip && tip.id)) el.removeAttribute('aria-describedby');
    described = false;
    vci.emit(el, 'tooltip:hide', { el: el });
  }

  function target(node) { return vci.closest(node && node.nodeType === 1 ? node : node && node.parentElement, M); }

  vci.ready(function () {
    d.addEventListener('pointerover', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      var el = target(e.target);
      if (!el || el === owner) return;
      clearTimeout(timer);
      if (owner) { show(el); return; } // moving between tooltips: no second wait
      var delay = vci.num(vci.config(M, 'delay', '300', el), 300);
      timer = setTimeout(function () { if (el.isConnected) show(el); }, delay);
    });
    d.addEventListener('pointerout', function (e) {
      var el = target(e.target);
      if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
      clearTimeout(timer);
      if (el === owner) hide();
    });
    d.addEventListener('focusin', function (e) {
      var el = target(e.target);
      if (!el) return;
      // Keyboard focus only: a click also focuses, and then the tooltip would cover what was clicked.
      try { if (!e.target.matches(':focus-visible')) return; } catch (x) { /* old browser: show anyway */ }
      show(el);
    });
    d.addEventListener('focusout', function (e) { if (owner && target(e.target) === owner) hide(); });
    d.addEventListener('pointerdown', hide, true);
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') hide(); });
    // Scrolling hides a shown tooltip but keeps a pending hover: a smooth scroll can still be
    // settling when the pointer comes to rest, and the tooltip is placed when it shows.
    function drop() { if (owner) hide(); }
    w.addEventListener('scroll', drop, { passive: true, capture: true });
    w.addEventListener('resize', drop);
  });

  return { show: show, hide: hide, current: function () { return owner; } };
});
