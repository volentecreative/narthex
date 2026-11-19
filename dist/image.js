/*! narthex v0.6.0 — image — https://github.com/volentecreative/narthex
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

/* narthex/image — right-sized responsive images.
 *
 * Webflow writes a srcset on every image but a sizes value that is a guess
 * (often "100vw"), so a phone downloads a far larger file than the slot the
 * image sits in. This sets each image's sizes to the width it is actually
 * rendered at, so the browser picks the smallest srcset file that fits.
 *
 * It has to get there before the image starts loading, so load it in the
 * <head> (not deferred): it then catches each <img> as the parser adds it.
 * Loaded in the footer it still helps every image that has not started yet
 * (lazy images below the fold, anything added later) and leaves the rest alone.
 *
 * Opt in on the <script> tag, on <html>, or with vci.settings.image = { sizes: true }:
 *   vci-image="sizes"          turn it on for the page
 *
 * SETTINGS (vci-image-<setting>)
 *   skip   "true" on an image, or any ancestor, to leave its sizes alone.
 *
 * What it does to an image, once: sets the sizes attribute to "<n>px", where n
 * is the rendered width (for object-fit: cover, the longer rendered side, since
 * the file has to cover the box). An image with no layout yet is watched until
 * it has one. A changed srcset is measured again. On resize, sizes only ever
 * grows: a file already downloaded is never swapped for a smaller one.
 *
 * EVENTS  vci:image:sized on the image, detail { image, width }
 * API     vci.image.enabled() · scan(root?) · fix(img)
 */
vci.define('image', function (vci) {
  'use strict';
  var w = window, d = document;
  var M = 'image';
  var name = vci.attrName(M);
  var supported = !!(w.WeakSet && w.MutationObserver);
  var done = supported ? new WeakSet() : null;
  var ro = supported && w.ResizeObserver ? new ResizeObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.contentRect.width && fix(e.target)) ro.unobserve(e.target);
    });
  }) : null;

  function enabled() {
    if (!supported) return false;
    var s = vci.settings[M];
    if (s && s.sizes != null) return vci.bool(s.sizes, false);
    var tag = d.querySelector('script[' + name + ']');
    if (tag) return tag.getAttribute(name) === 'sizes';
    return d.documentElement.getAttribute(name) === 'sizes';
  }

  // Rendered width the file has to fill, in CSS px. 0 = no layout yet.
  function need(img) {
    var r = img.getBoundingClientRect();
    if (!r.width || !r.height) return 0;
    return Math.ceil(getComputedStyle(img).objectFit === 'cover' ? Math.max(r.width, r.height) : r.width);
  }

  // True when there is nothing more to do for this image (sized, already
  // loaded, skipped, or not responsive); false when it is waiting for layout.
  function fix(img) {
    if (!supported || !img.srcset || done.has(img)) return true;
    if (img.complete && img.currentSrc) return true; // already downloaded: too late to help
    if (vci.bool(vci.config(M, 'skip', 'false', img), false)) return true;
    var width = need(img);
    if (!width) {
      if (ro) ro.observe(img);
      return false;
    }
    img.sizes = width + 'px';
    done.add(img);
    vci.emit(img, M + ':sized', { image: img, width: width });
    return true;
  }

  function scan(root) {
    root = root || d;
    if (root.tagName === 'IMG') fix(root);
    if (root.querySelectorAll) Array.prototype.forEach.call(root.querySelectorAll('img[srcset]'), fix);
  }

  function start() {
    new MutationObserver(function (records) {
      records.forEach(function (m) {
        if (m.type === 'attributes') {
          done['delete'](m.target);
          fix(m.target);
          return;
        }
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType === 1) scan(n);
        });
      });
    }).observe(d.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['srcset'] });

    vci.ready(function () { scan(d); });

    var timer;
    w.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        Array.prototype.forEach.call(d.querySelectorAll('img[srcset]'), function (img) {
          var width = need(img);
          if (width && done.has(img) && width > parseInt(img.sizes, 10)) {
            img.sizes = width + 'px';
            vci.emit(img, M + ':sized', { image: img, width: width });
          }
        });
      }, 200);
    });
  }

  if (enabled()) start();
  return { enabled: enabled, scan: scan, fix: fix };
});
