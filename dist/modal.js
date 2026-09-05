/*! narthex v0.2.0 — modal — https://github.com/volentecreative/narthex
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
  vci.version = '0.2.0';

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

/* narthex/modal — modals and bottom-sheet drawers, one engine.
 *
 * ROLES  (vci-modal="…")
 *   dialog   a modal host. Needs vci-modal-key="<key>".
 *   drawer   a bottom-sheet host. Same as dialog, plus: no ?modal= URL param,
 *            aria-expanded on its triggers, swipe-down to dismiss on touch.
 *   open     a trigger. vci-modal-key="<key>" names the host.
 *   close    closes the host it sits in (or everything, if it sits in none).
 *   part     an extra element inside a host that also receives the open class
 *            (a drawer's sliding panel; anything you animate separately).
 *            The FIRST part in a drawer is the panel that swipes.
 *   handle   the swipe grab area inside a drawer.
 *   scrim    the backdrop inside a drawer: fades as the panel is dragged, and
 *            clicking it closes the drawer.
 *   dim      a backdrop inside any host; clicking it closes the host.
 *   field    a form input inside a host that is filled on open with the
 *            trigger's vci-modal-value, else the host's, else the host's
 *            vci-modal="title" text, else the key.
 *   title    see field.
 *
 * SETTINGS (vci-modal-<setting>, on the host or any ancestor / <script> / vci.settings.modal)
 *   class      open-state class added to the host and its parts. Default is-visible.
 *   url        "true"/"false" — mirror open state into ?<param>=<key> and open from
 *              it on load. Default true for dialogs, false for drawers.
 *   param      the query-string key. Default modal.
 *   inline     a media query. While it matches the host is ordinary page content:
 *              it never opens, and it closes itself if the viewport crosses into it.
 *              e.g. vci-modal-inline="(min-width: 992px)" for a filter drawer that
 *              becomes a sidebar on desktop.
 *   swipe      "false" to disable drag-to-dismiss on a drawer.
 *   swipe-media media query in which swipe is active. Default (max-width: 991px).
 *   backdrop   "false" so clicking the host element itself does not close it.
 *
 * EVENTS  vci:modal:open / vci:modal:close on the host, detail { key, host, trigger }.
 *
 * Something else may toggle the open class — a Webflow interaction, site code,
 * a script that owned the dialog before narthex did. Every host's class is
 * watched, so the scroll lock, aria and events stay truthful either way.
 * API     vci.modal.open(key, triggerEl?) · close(keyOrEl?) · closeAll() · isOpen(key) · resolve(key)
 */
vci.define('modal', function (vci) {
  'use strict';
  var d = document, w = window;
  var M = 'modal';
  var RATIO = 0.25, VEL = 0.6, THRESH = 6, HIDE_MS = 300;
  var CTRL = 'button, a, input, select, textarea, label, [role="button"]';
  var lastTrigger = null;
  var drag = null;

  function isHost(el) { var r = vci.role(el, M); return r === 'dialog' || r === 'drawer'; }
  function isDrawer(el) { return vci.role(el, M) === 'drawer'; }
  function keyOf(el) { return vci.attr(el, 'modal-key') || el.id || ''; }
  function openClass(el) { return vci.config(M, 'class', 'is-visible', el); }
  function paramName(el) { return vci.config(M, 'param', 'modal', el); }
  function usesUrl(el) { return vci.bool(vci.config(M, 'url', isDrawer(el) ? 'false' : 'true', el), !isDrawer(el)); }
  function inlineMq(el) {
    var q = vci.attr(el, 'modal-inline');
    return q ? w.matchMedia(q) : null;
  }
  function isInline(el) { var mq = inlineMq(el); return !!(mq && mq.matches); }

  function hosts() {
    return vci.all(M, 'dialog').concat(vci.all(M, 'drawer'));
  }
  function resolve(k) {
    if (!k) return null;
    if (k.nodeType === 1) return k.closest(vci.sel(M, 'dialog') + ',' + vci.sel(M, 'drawer'));
    var esc = w.CSS && CSS.escape ? CSS.escape(k) : k.replace(/["\\]/g, '\\$&');
    var kq = '[' + vci.attrName('modal-key') + '="' + esc + '"]';
    var h = d.querySelector(vci.sel(M, 'dialog') + kq + ',' + vci.sel(M, 'drawer') + kq);
    if (h) return h;
    // Convenience: an id on (or inside) the host, so aria-controls="…" and
    // vci-modal-key="…" can share a value.
    var byId = d.getElementById(k);
    if (byId) return isHost(byId) ? byId : resolve(byId);
    return null;
  }
  function parts(el) { return [el].concat(vci.all(M, 'part', el)); }
  function openEls() { return hosts().filter(function (h) { return h.classList.contains(openClass(h)); }); }
  function triggersFor(el) {
    var k = keyOf(el);
    return vci.all(M, 'open').filter(function (t) { return vci.attr(t, 'modal-key') === k; });
  }

  function setParam(el, k) {
    var u = new URL(w.location.href);
    u.searchParams.set(paramName(el), k);
    history.replaceState(history.state, '', u);
  }
  function clearParam(el) {
    var u = new URL(w.location.href);
    var p = paramName(el);
    if (!u.searchParams.has(p)) return;
    u.searchParams.delete(p);
    history.replaceState(history.state, '', u);
  }

  function focusInto(el) {
    var c = vci.all(M, 'close', el)[0];
    if (c && c.matches(vci.FOCUSABLE)) { c.focus(); return; }
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    el.focus({ preventScroll: true });
  }
  // A CMS card's trigger is often the Collection Item (a div) because the card
  // is a component and attributes cannot bind inside a component definition.
  // Restore focus to the link inside it, not the unfocusable wrapper.
  function triggerTarget(trig) {
    if (!trig || !trig.matches) return null;
    if (trig.matches(vci.FOCUSABLE)) return trig;
    return trig.querySelector(vci.FOCUSABLE);
  }
  function fillFields(el, trig, k) {
    var fields = vci.all(M, 'field', el);
    if (!fields.length) return;
    var title = vci.all(M, 'title', el)[0];
    var v = vci.attr(trig, 'modal-value') || vci.attr(el, 'modal-value') ||
            (title && title.textContent.trim()) || k;
    fields.forEach(function (f) { f.value = v; });
  }

  // Bookkeeping for the open and closed states, separate from the class
  // change itself so the observer below can apply it when the class was
  // toggled by someone else.
  var state = new WeakMap();
  function applyOpen(el, k, trig) {
    state.set(el, true);
    if (!el.hasAttribute('role')) el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    vci.lock.hold(M + ':' + k);
    triggersFor(el).forEach(function (t) { t.setAttribute('aria-expanded', 'true'); });
    if (trig && trig.setAttribute) trig.setAttribute('aria-expanded', 'true');
    if (usesUrl(el)) setParam(el, k);
    vci.emit(el, 'modal:open', { key: k, host: el, trigger: trig || null });
  }
  function applyClose(el, k) {
    state.set(el, false);
    el.removeAttribute('aria-modal');
    vci.lock.release(M + ':' + k);
    triggersFor(el).forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
    if (usesUrl(el)) clearParam(el);
    vci.emit(el, 'modal:close', { key: k, host: el });
  }
  function watch(el) {
    if (state.has(el)) return;
    state.set(el, el.classList.contains(openClass(el)));
    new MutationObserver(function () {
      var open = el.classList.contains(openClass(el));
      if (open === !!state.get(el)) return;
      var k = keyOf(el);
      if (open) applyOpen(el, k, null);
      else {
        parts(el).forEach(function (p) { p.classList.remove(openClass(el)); });
        applyClose(el, k);
      }
    }).observe(el, { attributes: true, attributeFilter: ['class'] });
  }

  function show(k, trig) {
    var el = resolve(k);
    if (!el) return false;
    k = keyOf(el);
    if (isInline(el)) return false;
    var cls = openClass(el);
    if (el.classList.contains(cls)) return true;
    if (vci.emit(el, 'modal:beforeopen', { key: k, host: el, trigger: trig || null }, true).defaultPrevented) return false;
    openEls().forEach(function (o) { if (o !== el) hide(o, false); });

    watch(el);
    fillFields(el, trig, k);
    lastTrigger = triggerTarget(trig);
    applyOpen(el, k, trig);
    parts(el).forEach(function (p) { p.classList.add(cls); });
    focusInto(el);
    return true;
  }

  function hide(el, restore) {
    el = resolve(el);
    if (!el) return false;
    var cls = openClass(el);
    if (!el.classList.contains(cls)) return false;
    watch(el);
    applyClose(el, keyOf(el));
    parts(el).forEach(function (p) { p.classList.remove(cls); });
    if (lastTrigger && restore !== false && lastTrigger.focus) lastTrigger.focus();
    lastTrigger = null;
    return true;
  }

  function closeAll(restore) {
    openEls().forEach(function (el) { hide(el, restore); });
  }

  /* ---------- delegated events ---------- */
  d.addEventListener('click', function (e) {
    var o = vci.closest(e.target, M, 'open');
    if (o) {
      var k = vci.attr(o, 'modal-key');
      if (k && resolve(k)) { e.preventDefault(); show(k, o); return; }
    }
    var c = vci.closest(e.target, M, 'close');
    if (c) {
      e.preventDefault();
      var host = resolve(c);
      if (host) hide(host, true); else closeAll(true);
      return;
    }
    var dim = vci.closest(e.target, M, 'dim') || vci.closest(e.target, M, 'scrim');
    if (dim) { var dh = resolve(dim); if (dh) { hide(dh, true); return; } }
    // The host itself is usually the full-viewport shell; a click that lands on
    // it (not on the dialog box inside) is a backdrop click.
    if (isHost(e.target) && vci.bool(vci.config(M, 'backdrop', 'true', e.target), true)) {
      hide(e.target, true);
    }
  });

  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeAll(true); return; }
    if (e.key === 'Enter' || e.key === ' ') {
      // close affordances are often divs; give them button-like keyboard behaviour
      var c = e.target.closest && vci.closest(e.target, M, 'close');
      if (c && !c.matches('a[href], button')) { e.preventDefault(); c.click(); }
      return;
    }
    if (e.key !== 'Tab') return;
    var open = openEls()[0];
    if (!open) return;
    var f = vci.focusables(open);
    if (!f.length) { e.preventDefault(); return; }
    var first = f[0], last = f[f.length - 1];
    if (!open.contains(d.activeElement)) { e.preventDefault(); first.focus(); return; }
    if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- drawer swipe-to-dismiss ---------- */
  function swipeOn(el) {
    if (!vci.bool(vci.config(M, 'swipe', 'true', el), true)) return false;
    return w.matchMedia(vci.config(M, 'swipe-media', '(max-width: 991px)', el)).matches;
  }

  d.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    var h = vci.closest(e.target, M, 'handle');
    if (!h || e.target.closest(CTRL) || vci.closest(e.target, M, 'close')) return;
    var el = resolve(h);
    if (!el || !isDrawer(el) || !el.classList.contains(openClass(el)) || !swipeOn(el)) return;
    var pnl = vci.all(M, 'part', el)[0];
    if (!pnl) return;
    drag = { root: el, panel: pnl, handle: h, scrim: vci.all(M, 'scrim', el)[0] || null,
      base: 0.5, startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp,
      vel: 0, dy: 0, on: false, h: pnl.offsetHeight || 1, id: e.pointerId };
  });

  d.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.on) {
      if (Math.abs(e.clientY - drag.startY) < THRESH) return;
      drag.on = true;
      drag.startY = e.clientY;
      if (drag.handle.setPointerCapture) drag.handle.setPointerCapture(drag.id);
      drag.panel.style.transition = 'none';
      if (drag.scrim) {
        var o = parseFloat(getComputedStyle(drag.scrim).opacity);
        if (!isNaN(o) && o > 0) drag.base = o;
        drag.scrim.style.transition = 'none';
      }
    }
    var dy = e.clientY - drag.startY; if (dy < 0) dy = 0;
    var dt = e.timeStamp - drag.lastT;
    if (dt > 0) drag.vel = (e.clientY - drag.lastY) / dt;
    drag.lastY = e.clientY; drag.lastT = e.timeStamp; drag.dy = dy;
    drag.panel.style.transform = 'translateY(' + dy + 'px)';
    if (drag.scrim) {
      var pr = dy / drag.h; if (pr > 1) pr = 1;
      drag.scrim.style.opacity = (drag.base * (1 - pr)).toFixed(3);
    }
  });

  function endDrag(e) {
    if (!drag || (e && e.pointerId !== drag.id)) return;
    var dg = drag; drag = null;
    if (!dg.on) return;
    if (dg.handle.releasePointerCapture) {
      try { dg.handle.releasePointerCapture(dg.id); } catch (x) {}
    }
    var kill = dg.dy > dg.h * RATIO || dg.vel > VEL, done = false;
    function clean() {
      dg.panel.style.transition = ''; dg.panel.style.transform = '';
      if (dg.scrim) { dg.scrim.style.transition = ''; dg.scrim.style.opacity = ''; }
    }
    function fin() {
      if (done) return; done = true;
      dg.panel.removeEventListener('transitionend', onEnd);
      if (kill) { hide(dg.root, true); setTimeout(clean, HIDE_MS); } else clean();
    }
    function onEnd(ev) {
      if (ev.target === dg.panel && ev.propertyName === 'transform') fin();
    }
    dg.panel.addEventListener('transitionend', onEnd);
    dg.panel.style.transition = 'transform 250ms ease';
    dg.panel.style.transform = kill ? 'translateY(100%)' : 'translateY(0px)';
    if (dg.scrim) {
      dg.scrim.style.transition = 'opacity 250ms ease';
      dg.scrim.style.opacity = kill ? '0' : String(dg.base);
    }
    setTimeout(fin, 400);
  }
  d.addEventListener('pointerup', endDrag);
  d.addEventListener('pointercancel', endDrag);

  /* ---------- init ---------- */
  vci.ready(function () {
    hosts().forEach(function (el) {
      var k = keyOf(el);
      triggersFor(el).forEach(function (t) {
        t.setAttribute('aria-expanded', 'false');
        if (!t.hasAttribute('aria-haspopup')) t.setAttribute('aria-haspopup', 'dialog');
      });
      var mq = inlineMq(el);
      if (mq) mq.addEventListener('change', function (ev) { if (ev.matches) hide(el, false); });
      // Something already open on load (a Designer state left on, or a class
      // set server-side) still needs the lock and aria.
      if (el.classList.contains(openClass(el))) { state.set(el, false); applyOpen(el, k, null); }
      watch(el);
    });
    var params = new URLSearchParams(w.location.search);
    hosts().some(function (el) {
      if (!usesUrl(el)) return false;
      var k = params.get(paramName(el));
      if (k && resolve(k) === el) { show(k, null); return true; }
      return false;
    });
  });

  return {
    open: show,
    close: function (k) { return k == null ? (closeAll(true), true) : hide(k, true); },
    closeAll: function () { closeAll(true); },
    isOpen: function (k) { var el = resolve(k); return !!el && el.classList.contains(openClass(el)); },
    resolve: resolve,
    openHosts: openEls
  };
});
