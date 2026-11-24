/*! narthex v0.8.0 — words — https://github.com/volentecreative/narthex
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

/* narthex/words — staggered word-by-word reveal for a large line of text.
 *
 * Splits the text inside the element into words and brings them in one after
 * another the first time the element scrolls into view: each word fades in and
 * rises a short distance into place. Markup inside is kept as it is — links,
 * spans with classes, icons — only the bare text is split, so a phrase wrapped
 * in a no-wrap span still never breaks. An inline <svg> or <img> counts as one
 * word, so an icon arrives in turn with the word beside it.
 *
 * ROLE  vci-words="reveal"   on the heading or paragraph to animate
 *
 * SETTINGS  (vci-words-<setting>, on the element or any ancestor)
 *   stagger    ms between words. Default 45.
 *   duration   ms each word takes. Default 700.
 *   rise       CSS length each word rises from. Default 0.45em.
 *   easing     Default cubic-bezier(.2,.7,.2,1).
 *   threshold  0..1 of the element in view before it starts. Default 0.35.
 *   class      class added to the element once every word is in. Default is-revealed.
 *
 * EVENTS  vci:words:start and vci:words:done on the element, detail { units }
 *         — hook further animation (an icon drawing itself) onto these.
 *
 * Safe by construction: nothing is hidden unless this runs; reduced motion and
 * browsers without IntersectionObserver / Web Animations get the plain text;
 * only opacity and transform animate. Each word is an inline-block span marked
 * vci-words-unit; spaces stay real text so wrapping and copy/paste are normal.
 */
vci.define('words', function (vci) {
  'use strict';
  var w = window, d = document;
  var M = 'words';
  var UNIT = vci.attrName('words-unit');
  var motionOk = !!(w.IntersectionObserver && Element.prototype.animate) &&
    !(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function split(el) {
    var units = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/);
          if (parts.length < 2 && !parts[0].trim()) return;
          var frag = d.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(d.createTextNode(p)); return; }
            var s = d.createElement('span');
            s.setAttribute(UNIT, '');
            s.style.display = 'inline-block';
            s.textContent = p;
            frag.appendChild(s);
            units.push(s);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          var tag = n.tagName.toLowerCase();
          if (tag === 'svg' || tag === 'img') { units.push(n); return; }
          if (n.hasAttribute(UNIT)) { units.push(n); return; }
          walk(n);
        }
      });
    })(el);
    return units;
  }

  function play(el, units) {
    var stagger = vci.num(vci.config(M, 'stagger', 45, el), 45);
    var dur = vci.num(vci.config(M, 'duration', 700, el), 700);
    var rise = vci.config(M, 'rise', '0.45em', el);
    var ease = vci.config(M, 'easing', 'cubic-bezier(.2,.7,.2,1)', el);
    var cls = vci.config(M, 'class', 'is-revealed', el);
    vci.emit(el, 'words:start', { units: units });
    var last = null;
    units.forEach(function (u, i) {
      last = u.animate(
        [{ opacity: 0, transform: 'translateY(' + rise + ')' }, { opacity: 1, transform: 'none' }],
        { duration: dur, delay: i * stagger, easing: ease, fill: 'backwards' });
      u.style.opacity = '';
    });
    var finish = function () { el.classList.add(cls); vci.emit(el, 'words:done', { units: units }); };
    if (last) last.onfinish = finish; else finish();
  }

  function init(el) {
    if (el.__vciWords) return;
    el.__vciWords = true;
    var units = split(el);
    if (!motionOk || !units.length) return;
    units.forEach(function (u) { u.style.opacity = '0'; });
    var threshold = vci.num(vci.config(M, 'threshold', 0.35, el), 0.35);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.disconnect();
        play(el, units);
      });
    }, { threshold: threshold });
    io.observe(el);
    // Anything that needs it visible right now (find-in-page, focus, print) gets it.
    var reveal = function () { io.disconnect(); units.forEach(function (u) { u.style.opacity = ''; }); };
    el.addEventListener('focusin', reveal, { once: true });
    w.addEventListener('beforeprint', reveal, { once: true });
  }

  function scan(root) { vci.all(M, 'reveal', root).forEach(init); }
  vci.ready(function () { scan(); });
  return { scan: scan, split: split };
});
