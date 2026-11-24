/*! narthex v0.8.0 — dropdown — https://github.com/volentecreative/narthex
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
  vci.version = '0.8.0';

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

/* narthex/dropdown — a safe triangle for hover dropdowns (Webflow's, or any that open on mouseover).
 *
 * Moving the mouse diagonally from a tab down into its open panel often crosses a
 * neighbouring tab, which opens instead — or the open one closes the moment the
 * pointer leaves its tab. This holds both back while the pointer is aiming at the
 * open panel: inside the triangle from where the pointer was a moment ago to the
 * panel's top corners, and heading clearly downward. Resting on the other tab, or
 * turning away, lets the held hover through after all.
 *
 * It works by holding the mouseover/mouseout events the dropdowns listen for (jQuery's
 * mouseenter/mouseleave, as Webflow uses, ride on those), in the capture phase on the
 * group, and replaying them when the hold ends. Nothing is restyled; touch is untouched.
 *
 * ROLES  (vci-dropdown="…")
 *   group   a wrapper around the hover dropdowns (a navbar menu). Each dropdown inside it
 *           is found by the item setting; its panel by the list setting.
 *
 * SETTINGS (vci-dropdown-<setting>, on the group or any ancestor / <script> / vci.settings.dropdown)
 *   item          selector for one dropdown. Default .w-dropdown
 *   list          selector for its panel, inside the item. Default .w-dropdown-list
 *   class         open-state class on the panel. Default w--open
 *   safe-triangle "false" to turn the hold off.
 *   rest          ms resting on another tab inside the triangle before it opens anyway. Default 120.
 *   slope         how steeply down (dy/dx) the pointer must move to count as aiming. Default 0.35.
 *   pad           px the triangle's base overhangs the panel on each side. Default 12.
 *
 * EVENTS  vci:dropdown:hold on the item held back, detail { item, open }
 *         vci:dropdown:release on it when the hold ends, detail { item, open, replayed }
 * API     vci.dropdown.init(root?) · aiming(panelEl) — true while the pointer heads for it
 */
vci.define('dropdown', function (vci) {
  'use strict';
  var w = window, d = document;
  var M = 'dropdown';
  var pt = null, anchor = null, apex = null, mouse = true;

  // The pointer now, a few px ago (anchor) and a few px before that (apex, the triangle's tip).
  d.addEventListener('pointermove', function (e) {
    mouse = e.pointerType === 'mouse';
    var p = { x: e.clientX, y: e.clientY };
    if (!anchor) anchor = apex = p;
    var dx = p.x - anchor.x, dy = p.y - anchor.y;
    if (dx * dx + dy * dy > 36) { apex = anchor; anchor = p; }
    pt = p;
  }, { passive: true, capture: true });

  function side(p, a, b) { return (p.x - b.x) * (a.y - b.y) - (a.x - b.x) * (p.y - b.y); }

  function aiming(panel, group) {
    if (!panel || !pt || !apex) return false;
    var r = panel.getBoundingClientRect();
    if (!r.width || !r.height || pt.y >= r.top) return false;
    var slope = vci.num(vci.config(M, 'slope', '0.35', group), 0.35);
    var pad = vci.num(vci.config(M, 'pad', '12', group), 12);
    // Clearly heading down; a pointer low on the tabs otherwise makes a flat triangle
    // that would hold ordinary sideways moves between tabs.
    if (pt.y - apex.y < 1 || pt.y - apex.y < slope * Math.abs(pt.x - apex.x)) return false;
    var l = { x: r.left - pad, y: r.top }, rr = { x: r.right + pad, y: r.top };
    var d1 = side(pt, apex, l), d2 = side(pt, l, rr), d3 = side(pt, rr, apex);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  }

  function wire(group) {
    if (group.__vciDropdown) return;
    group.__vciDropdown = true;
    var itemSel = vci.config(M, 'item', '.w-dropdown', group);
    var listSel = vci.config(M, 'list', '.w-dropdown-list', group);
    var openCls = vci.config(M, 'class', 'w--open', group);
    var rest = vci.num(vci.config(M, 'rest', '120', group), 120);
    var held = []; // events kept back, replayed in order when the hold ends
    var timer = 0, replaying = false, holding = null;

    function itemOf(node) {
      var it = node && node.closest ? node.closest(itemSel) : null;
      return it && group.contains(it) ? it : null;
    }
    function panelOf(it) { return it ? it.querySelector(listSel) : null; }
    function openItem() {
      var all = group.querySelectorAll(itemSel);
      for (var i = 0; i < all.length; i++) { var p = panelOf(all[i]); if (p && p.classList.contains(openCls)) return all[i]; }
      return null;
    }
    function on() { return mouse && vci.bool(vci.config(M, 'safe-triangle', 'true', group), true); }

    function fire(target, type, related) {
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: w, clientX: pt ? pt.x : 0, clientY: pt ? pt.y : 0, relatedTarget: related || null }));
    }
    // End the hold. With replay, act on where the pointer is NOW (not on every crossing it made
    // on the way): leave the open dropdown if the pointer is outside it, and enter the one under it.
    function release(replay) {
      clearTimeout(timer);
      var open = holding, out = null;
      held.forEach(function (h) { if (h.type === 'mouseout') out = out || h.target; });
      holding = null; held = [];
      if (!open) return;
      if (replay && pt) {
        var over = d.elementFromPoint(pt.x, pt.y);
        replaying = true;
        if (!open.contains(over)) fire(out && out.isConnected ? out : open, 'mouseout', over);
        var next = itemOf(over);
        if (next && next !== open) fire(over, 'mouseover', null);
        replaying = false;
      }
      vci.emit(open, 'dropdown:release', { item: open, open: open, replayed: !!replay });
    }

    function intercept(e) {
      if (replaying) return;
      var open = holding || openItem();
      if (!open || !on()) return;
      var from = itemOf(e.target), to = itemOf(e.relatedTarget);
      // Only the crossings that would close the open one or open another.
      var leaving = e.type === 'mouseout' && from === open && to !== open;
      var entering = e.type === 'mouseover' && from && from !== open && itemOf(e.relatedTarget) !== from;
      var other = e.type === 'mouseover' && from && from !== open && holding; // moving within the held tab
      if (!leaving && !entering && !other) return;
      if (!holding && !aiming(panelOf(open), group)) return;
      e.stopImmediatePropagation();
      held.push({ type: e.type, target: e.target });
      if (!holding) { holding = open; vci.emit(open, 'dropdown:hold', { item: from || open, open: open }); }
      // Resting on another tab: it gets its turn after all.
      clearTimeout(timer);
      timer = setTimeout(function () { release(true); }, rest);
    }
    group.addEventListener('mouseover', intercept, true);
    group.addEventListener('mouseout', intercept, true);

    // Each move while holding: reached the panel (or back on its tab) ends the hold quietly;
    // turning away from the panel lets the held hovers through now.
    d.addEventListener('pointermove', function () {
      if (!holding) return;
      var over = d.elementFromPoint(pt.x, pt.y);
      if (holding.contains(over)) { release(false); return; }
      if (!aiming(panelOf(holding), group)) release(true);
    }, { passive: true });
  }

  function init(root) { vci.all(M, 'group', root).forEach(wire); }
  vci.ready(function () { init(); });
  return { init: init, aiming: function (panel) { return aiming(panel, panel); } };
});
