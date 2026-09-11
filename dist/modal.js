/*! narthex v0.5.0 — modal — https://github.com/volentecreative/narthex
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
  vci.version = '0.5.0';

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
 *   enter      entrance animation for the host's parts, and a fade for its
 *              dim/scrim: "sheet" (up from the bottom where the drawer is a
 *              bottom sheet, a small rise above it), "rise", "fade", or "none".
 *              Default none, so a host that already animates itself is left
 *              alone. Needs at least one vci-modal="part" to animate.
 *   enter-duration  length of that animation. Default 300ms.
 *   exit       how it leaves. "match" (default) mirrors enter, or name one of
 *              the same values, or "none" to snap away.
 *   exit-duration   length of the exit. Default 250ms — a little quicker than
 *              the entrance, which is how a leaving thing should feel.
 *
 * EVENTS  vci:modal:open / vci:modal:close on the host, detail { key, host, trigger }.
 *
 * Something else may toggle the open class — a Webflow interaction, site code,
 * a script that owned the dialog before narthex did. Every host's class is
 * watched, so the scroll lock, aria and events stay truthful either way.
 *
 * An open host also carries vci-modal-state="open", and vci-modal-state="closing"
 * while an exit animation plays. The open class is the site's to name
 * (vci-modal-class), so anything this module styles keys off that attribute
 * instead, and site CSS can use it the same way.
 *
 * A host with an exit keeps the open class until the animation ends — it is
 * the site's own open styling that keeps the host painted, and dropping it is
 * what makes a close look instant. The bookkeeping does not wait: the scroll
 * lock, aria, ?modal= and vci:modal:close all happen the moment close is
 * asked for, so isOpen() never claims a leaving host is open.
 * API     vci.modal.open(key, triggerEl?) · close(keyOrEl?, restore?) · closeAll(restore?)
 *         · isOpen(key) · resolve(key)
 *         restore=false leaves focus where it is on close, for a caller that
 *         restores it itself.
 *
 * The open class can be set on hosts that did not exist at load (rendered
 * later, or annotated by site code): open() resolves live, and the URL param,
 * inline media query and class observer are armed the first time a host is
 * touched. While a host is open the shared scroll lock names it as the one
 * region a finger may scroll inside — see the lock in core.
 */
vci.define('modal', function (vci) {
  'use strict';
  var d = document, w = window;
  var M = 'modal';
  var RATIO = 0.25, VEL = 0.6, THRESH = 6, HIDE_MS = 300;
  var CTRL = 'button, a, input, select, textarea, label, [role="button"]';
  var A = vci.attrName;
  var ST = '[' + A('modal-state') + '="open"]';
  var CL = '[' + A('modal-state') + '="closing"]';
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

  // The first close affordance is often a scrim or a div (not focusable), so
  // walk for one that takes focus before falling back to the host itself.
  function focusTarget(el) {
    var closes = vci.all(M, 'close', el);
    for (var i = 0; i < closes.length; i++) {
      if (closes[i].matches(vci.FOCUSABLE)) return closes[i];
    }
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
    return el;
  }
  // Focus now, and again two frames later if it did not take: a host whose
  // visibility is mid-transition from hidden refuses focus silently, and by
  // the second frame the transition has progressed enough to compute visible.
  function focusInto(el) {
    var t = focusTarget(el);
    try { t.focus({ preventScroll: true }); } catch (x) { t.focus(); }
    if (!w.requestAnimationFrame) return;
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      if (!el.classList.contains(openClass(el)) || el.contains(d.activeElement)) return;
      var t2 = focusTarget(el);
      try { t2.focus({ preventScroll: true }); } catch (x) { t2.focus(); }
    }); });
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
    el.setAttribute(A('modal-state'), 'open');
    vci.lock.hold(M + ':' + k, el);
    triggersFor(el).forEach(function (t) { t.setAttribute('aria-expanded', 'true'); });
    if (trig && trig.setAttribute) trig.setAttribute('aria-expanded', 'true');
    if (usesUrl(el)) setParam(el, k);
    vci.emit(el, 'modal:open', { key: k, host: el, trigger: trig || null });
  }
  function applyClose(el, k) {
    state.set(el, false);
    el.removeAttribute('aria-modal');
    el.removeAttribute(A('modal-state'));
    vci.lock.release(M + ':' + k);
    triggersFor(el).forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
    if (usesUrl(el)) clearParam(el);
    vci.emit(el, 'modal:close', { key: k, host: el });
  }
  /* ---------- entrance animation ---------- */
  // Off unless a host asks for it, so a site that already animates its own
  // panel off the open class keeps doing exactly that.
  //
  // This is an animation and not a transition on purpose. A host that shows
  // itself by flipping display:none to flex has nothing to transition *from* —
  // the panel is laid out for the first time already in its open state, and a
  // transition on that first frame is dead code. An animation just runs when
  // the element is first rendered, which is the same moment. It also carries
  // no fill-mode, so the instant it finishes the panel is back under its own
  // styles and a drawer's drag, which writes inline transforms, is untouched.
  var ENTER = { sheet: 1, rise: 1, fade: 1 };
  function enterOf(el) {
    var v = vci.config(M, 'enter', 'none', el);
    return ENTER[v] ? v : 'none';
  }
  function enterSel(v) { return '[' + A('modal-enter') + '="' + v + '"]' + ST; }
  function exitOf(el) {
    var v = vci.config(M, 'exit', 'match', el);
    if (v === 'match') v = enterOf(el);
    return ENTER[v] ? v : 'none';
  }
  function exitSel(v) { return '[' + A('modal-exit') + '="' + v + '"]' + CL; }
  function reduced() {
    return !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  // "300ms" / "0.3s" / "300" -> 300
  function toMs(v, fallback) {
    var n = parseFloat(v);
    if (isNaN(n)) return fallback;
    v = String(v).trim();
    return /ms$/.test(v) ? n : (/s$/.test(v) ? n * 1000 : n);
  }
  function exitMs(el) {
    if (exitOf(el) === 'none' || reduced()) return 0;
    return toMs(vci.config(M, 'exit-duration', '250ms', el), 250);
  }
  var cssDone = false;
  function injectEnterCss() {
    if (cssDone) return;
    cssDone = true;
    // One stylesheet for every host, so the breakpoint that decides where a
    // sheet slides rather than rises is read once, globally — a per-host
    // swipe-media still moves that host's swipe, but not this.
    var mq = vci.config(M, 'swipe-media', '(max-width: 991px)', d.documentElement);
    var part = vci.sel(M, 'part'), panels = [], backs = [];
    for (var v in ENTER) {
      panels.push(enterSel(v) + ' ' + part);
      backs.push(enterSel(v) + ' ' + vci.sel(M, 'dim'), enterSel(v) + ' ' + vci.sel(M, 'scrim'));
    }
    var every = panels.concat(backs).join(',');
    var exitPanels = [], exitBacks = [];
    for (var v2 in ENTER) {
      exitPanels.push(exitSel(v2) + ' ' + part);
      exitBacks.push(exitSel(v2) + ' ' + vci.sel(M, 'dim'), exitSel(v2) + ' ' + vci.sel(M, 'scrim'));
    }
    var everyExit = exitPanels.concat(exitBacks).join(',');
    vci.css('modal-enter',
      '@keyframes vci-modal-fade{from{opacity:0}}' +
      '@keyframes vci-modal-rise{from{opacity:0;transform:translateY(.75rem)}}' +
      '@keyframes vci-modal-sheet{from{transform:translateY(100%)}}' +
      every + '{animation-duration:var(--vci-modal-enter,300ms);' +
        'animation-timing-function:cubic-bezier(.2,.8,.2,1)}' +
      backs.join(',') + '{animation-name:vci-modal-fade;animation-timing-function:ease}' +
      enterSel('fade') + ' ' + part + '{animation-name:vci-modal-fade}' +
      enterSel('rise') + ' ' + part + '{animation-name:vci-modal-rise}' +
      // A sheet is only a sheet where it sits on the bottom edge; above that
      // breakpoint the same host is a centred dialog, and sliding it up from
      // off-screen would read as a mistake.
      enterSel('sheet') + ' ' + part + '{animation-name:vci-modal-rise}' +
      '@media ' + mq + '{' + enterSel('sheet') + ' ' + part +
        '{animation-name:vci-modal-sheet;animation-timing-function:cubic-bezier(.2,.9,.25,1)}}' +
      // Leaving. fill-mode forwards holds the end state until the open class
      // drops, so there is no frame of the panel snapping back before it goes;
      // the state attribute comes off at the same moment, so nothing lingers
      // to outrank a drawer's inline drag transform later.
      '@keyframes vci-modal-fade-out{to{opacity:0}}' +
      '@keyframes vci-modal-rise-out{to{opacity:0;transform:translateY(.75rem)}}' +
      '@keyframes vci-modal-sheet-out{to{transform:translateY(100%)}}' +
      CL + '{pointer-events:none}' +
      everyExit + '{animation-duration:var(--vci-modal-exit,250ms);' +
        'animation-timing-function:cubic-bezier(.4,0,1,1);animation-fill-mode:forwards}' +
      exitBacks.join(',') + '{animation-name:vci-modal-fade-out;animation-timing-function:ease}' +
      exitSel('fade') + ' ' + part + '{animation-name:vci-modal-fade-out}' +
      exitSel('rise') + ' ' + part + '{animation-name:vci-modal-rise-out}' +
      exitSel('sheet') + ' ' + part + '{animation-name:vci-modal-rise-out}' +
      '@media ' + mq + '{' + exitSel('sheet') + ' ' + part +
        '{animation-name:vci-modal-sheet-out}}' +
      '@media (prefers-reduced-motion:reduce){' + every + ',' + everyExit + '{animation:none}}');
  }
  var enterArmed = new WeakMap();
  function armEnter(el) {
    if (enterArmed.has(el)) return;
    enterArmed.set(el, true);
    var en = enterOf(el), ex = exitOf(el);
    if (en === 'none' && ex === 'none') return;
    injectEnterCss();
    // Settings resolve through ancestors, vci.settings and the script tag, but
    // the CSS has to match on the host, so write the resolved values back onto
    // it. Same value they already had when set there directly.
    if (en !== 'none') el.setAttribute(A('modal-enter'), en);
    if (ex !== 'none') el.setAttribute(A('modal-exit'), ex);
    var dur = vci.config(M, 'enter-duration', '', el);
    if (dur) el.style.setProperty('--vci-modal-enter', dur);
    var xdur = vci.config(M, 'exit-duration', '', el);
    if (xdur) el.style.setProperty('--vci-modal-exit', xdur);
  }

  // The inline media query closes the host when the viewport crosses into
  // it (its content is ordinary page content there). Armed once per host,
  // whether the host was on the page at load or turned up later.
  var armed = new WeakMap();
  function armInline(el) {
    if (armed.has(el)) return;
    armed.set(el, true);
    var mq = inlineMq(el);
    if (!mq) return;
    var onChange = function (ev) { if (ev.matches) hide(el, false); };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }
  function watch(el) {
    armInline(el);
    armEnter(el);
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
    // Caught on the way out: cancel the exit and open again from wherever the
    // animation had got to, rather than reporting it already open and doing
    // nothing while it finishes leaving.
    if (closing.get(el)) cancelExit(el);
    else if (el.classList.contains(cls)) return true;
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

  // An exit needs the host to stay painted after close is asked for, and what
  // paints it is the site's own open class — so that one class is the only
  // thing that waits. Everything else in applyClose runs now.
  var closing = new WeakMap();
  function cancelExit(el) {
    var c = closing.get(el);
    if (!c) return;
    clearTimeout(c.timer);
    closing['delete'](el);
    el.removeAttribute(A('modal-state'));
  }
  function drop(el, cls) {
    cancelExit(el);
    parts(el).forEach(function (p) { p.classList.remove(cls); });
  }
  // immediate: the caller already played the exit itself — a drawer dragged
  // off-screen has nothing left to animate and should not wait to be hidden.
  function hide(el, restore, immediate) {
    el = resolve(el);
    if (!el) return false;
    var cls = openClass(el);
    if (!el.classList.contains(cls)) return false;
    if (closing.get(el)) return false;
    watch(el);
    applyClose(el, keyOf(el));
    var wait = immediate ? 0 : exitMs(el);
    if (!wait) drop(el, cls);
    else {
      el.setAttribute(A('modal-state'), 'closing');
      closing.set(el, { timer: setTimeout(function () { drop(el, cls); }, wait + 30) });
    }
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
      // A grab during the entrance animation takes the panel off it. While an
      // animation runs it outranks inline styles, so the drag below would move
      // nothing — and the scrim's opacity would be read mid-fade, making the
      // backdrop jump when the drag hands it back.
      drag.panel.style.animation = 'none';
      drag.panel.style.transition = 'none';
      if (drag.scrim) {
        drag.scrim.style.animation = 'none';
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
      dg.panel.style.animation = '';
      if (dg.scrim) {
        dg.scrim.style.transition = ''; dg.scrim.style.opacity = '';
        dg.scrim.style.animation = '';
      }
    }
    function fin() {
      if (done) return; done = true;
      dg.panel.removeEventListener('transitionend', onEnd);
      if (kill) { hide(dg.root, true, true); setTimeout(clean, HIDE_MS); } else clean();
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
    close: function (k, restore) {
      restore = restore !== false;
      return k == null ? (closeAll(restore), true) : hide(k, restore);
    },
    closeAll: function (restore) { closeAll(restore !== false); },
    isOpen: function (k) {
      var el = resolve(k);
      return !!el && el.classList.contains(openClass(el)) && !closing.get(el);
    },
    resolve: resolve,
    openHosts: function () {
      return openEls().filter(function (el) { return !closing.get(el); });
    }
  };
});
