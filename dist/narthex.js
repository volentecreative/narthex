/*! narthex v0.1.0 — all modules — https://github.com/volentecreative/narthex
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
  vci.version = '0.1.0';

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

  function show(k, trig) {
    var el = resolve(k);
    if (!el) return false;
    k = keyOf(el);
    if (isInline(el)) return false;
    var cls = openClass(el);
    if (el.classList.contains(cls)) return true;
    if (vci.emit(el, 'modal:beforeopen', { key: k, host: el, trigger: trig || null }, true).defaultPrevented) return false;
    openEls().forEach(function (o) { if (o !== el) hide(o, false); });

    fillFields(el, trig, k);
    lastTrigger = triggerTarget(trig);
    parts(el).forEach(function (p) { p.classList.add(cls); });

    if (!el.hasAttribute('role')) el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    vci.lock.hold(M + ':' + k);
    triggersFor(el).forEach(function (t) { t.setAttribute('aria-expanded', 'true'); });
    if (trig && trig.setAttribute) trig.setAttribute('aria-expanded', 'true');
    if (usesUrl(el)) setParam(el, k);
    focusInto(el);
    vci.emit(el, 'modal:open', { key: k, host: el, trigger: trig || null });
    return true;
  }

  function hide(el, restore) {
    el = resolve(el);
    if (!el) return false;
    var cls = openClass(el);
    if (!el.classList.contains(cls)) return false;
    var k = keyOf(el);
    parts(el).forEach(function (p) { p.classList.remove(cls); });
    el.removeAttribute('aria-modal');
    vci.lock.release(M + ':' + k);
    triggersFor(el).forEach(function (t) { t.setAttribute('aria-expanded', 'false'); });
    if (usesUrl(el)) clearParam(el);
    if (lastTrigger && restore !== false && lastTrigger.focus) lastTrigger.focus();
    lastTrigger = null;
    vci.emit(el, 'modal:close', { key: k, host: el });
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
      if (el.classList.contains(openClass(el))) { vci.lock.hold(M + ':' + k); el.setAttribute('aria-modal', 'true'); }
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

/* narthex/accordion — class-and-state toggling for any accordion markup, plus a
 * builder that turns a rich-text field into accordion rows.
 *
 * ROLES  (vci-accordion="…")
 *   item      one collapsible row. Gets the open class and vci-accordion-state.
 *   trigger   the clickable heading inside an item. Gets aria-expanded and
 *             vci-accordion-state. Made keyboard-operable if it is not a button.
 *   body      the collapsing panel inside an item. Gets vci-accordion-state,
 *             aria-hidden and inert while closed.
 *   icon      an optional chevron inside the trigger (rotates via the built-in CSS).
 *   group     a wrapper; with vci-accordion-single="true" only one item inside
 *             it is open at a time.
 *   richtext  a rich-text block to convert. Authoring contract:
 *               H1            starts a section (rendered as vci-accordion-section-tag, default h4)
 *               H2–H6         an accordion row (rendered as vci-accordion-item-tag, default h5)
 *               anything else panel content for the row above; before the first row
 *                             of a section it is intro copy and stays put
 *               <hr>          closes the open row so a closing paragraph belongs to
 *                             the page, not the last panel. The rule is not rendered.
 *
 * SETTINGS (vci-accordion-<setting>)
 *   class      open-state class on the item. Default is-open.
 *   open       "true" on an item to start open.
 *   single     "true" on a group: opening one item closes its siblings.
 *   click      "trigger" — only the trigger toggles. Default "item": a click
 *              anywhere on a closed item opens it (the trigger alone closes it).
 *   css        "false" to skip the built-in grid-rows collapse CSS.
 *   duration   transition length for the built-in CSS. Default 300ms.
 *   Rich-text builder only (put them on the richtext element or an ancestor):
 *   section-tag, item-tag, section-class, title-class, heading-class,
 *   stack-class, item-class, trigger-class, icon-class, body-class,
 *   inner-class, text-class, icon ("false" to omit the chevron)
 *
 * EVENTS  vci:accordion:toggle on the item, detail { item, open }
 *         vci:accordion:built on the richtext element once rows exist
 * API     vci.accordion.open(item) · close(item) · toggle(item) · init(root?) · build(el)
 */
vci.define('accordion', function (vci) {
  'use strict';
  var d = document;
  var M = 'accordion';
  var A = vci.attrName;
  var CHEVRON = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" stroke-width="1.67"></path></svg>';

  function injectCss(root) {
    if (!vci.bool(vci.config(M, 'css', 'true', root), true)) return;
    var dur = vci.config(M, 'duration', '300ms', root);
    var body = vci.sel(M, 'body'), trig = vci.sel(M, 'trigger'), icon = vci.sel(M, 'icon');
    var st = '[' + A('accordion-state') + '="open"]';
    vci.css('accordion',
      body + '{display:grid;grid-template-rows:0fr;transition:grid-template-rows ' + dur + ' ease}' +
      body + '>*{overflow:hidden;min-height:0}' +
      body + st + '{grid-template-rows:1fr}' +
      icon + '{transition:transform ' + dur + ' ease}' +
      trig + st + ' ' + icon + '{transform:rotate(180deg)}' +
      '@media (prefers-reduced-motion:reduce){' + body + ',' + icon + '{transition:none}}');
  }

  function triggerOf(item) {
    return vci.all(M, 'trigger', item).filter(function (t) { return vci.closest(t.parentNode, M, 'item') === item; })[0] || null;
  }
  function bodyOf(item) {
    return vci.all(M, 'body', item).filter(function (b) { return vci.closest(b.parentNode, M, 'item') === item; })[0] || null;
  }

  function setOpen(item, open, silent) {
    var cls = vci.config(M, 'class', 'is-open', item);
    item.classList.toggle(cls, open);
    item.setAttribute(A('accordion-state'), open ? 'open' : 'closed');
    var t = triggerOf(item), b = bodyOf(item);
    if (t) { t.setAttribute('aria-expanded', String(open)); t.setAttribute(A('accordion-state'), open ? 'open' : 'closed'); }
    if (b) {
      b.setAttribute(A('accordion-state'), open ? 'open' : 'closed');
      b.setAttribute('aria-hidden', String(!open));
      if ('inert' in b) b.inert = !open;
    }
    if (!silent) vci.emit(item, 'accordion:toggle', { item: item, open: open });
  }
  function open(item) {
    var g = vci.closest(item.parentNode, M, 'group');
    if (g && vci.bool(vci.config(M, 'single', 'false', g), false)) {
      vci.all(M, 'item', g).forEach(function (o) {
        if (o !== item && vci.closest(o.parentNode, M, 'group') === g) setOpen(o, false);
      });
    }
    setOpen(item, true);
  }
  function close(item) { setOpen(item, false); }
  function toggle(item) {
    if (item.getAttribute(A('accordion-state')) === 'open') close(item); else open(item);
  }

  function initItem(item) {
    var t = triggerOf(item);
    if (t && !t.matches('button, a[href], [tabindex]')) { t.setAttribute('role', 'button'); t.setAttribute('tabindex', '0'); }
    setOpen(item, vci.bool(vci.attr(item, 'accordion-open'), false), true);
  }
  function init(root) {
    injectCss(root || d.documentElement);
    vci.all(M, 'item', root).forEach(initItem);
  }

  d.addEventListener('click', function (e) {
    var item = vci.closest(e.target, M, 'item');
    if (!item) return;
    var t = vci.closest(e.target, M, 'trigger');
    var onTrigger = !!t && vci.closest(t.parentNode, M, 'item') === item;
    if (onTrigger) { e.preventDefault(); toggle(item); return; }
    var mode = vci.config(M, 'click', 'item', item);
    if (mode !== 'trigger' && item.getAttribute(A('accordion-state')) !== 'open') open(item);
  });
  d.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var t = vci.closest(e.target, M, 'trigger');
    if (!t || t.matches('button, a[href]')) return;
    e.preventDefault();
    t.click();
  });

  /* ---------- rich text -> accordion ---------- */
  function retag(el, newTag) {
    var n = d.createElement(newTag);
    if (el.className) n.className = el.className;
    while (el.firstChild) n.appendChild(el.firstChild);
    return n;
  }
  function cls(el, name) { return vci.config(M, name + '-class', '', el); }
  function withClass(el, name, root) { var c = cls(root, name); if (c) el.className = (el.className ? el.className + ' ' : '') + c; return el; }
  function mark(el, role) { el.setAttribute(A(M), role); return el; }

  function makeItem(headingEl, rt) {
    var item = withClass(mark(d.createElement('div'), 'item'), 'item', rt);
    withClass(headingEl, 'heading', rt);

    var btn = withClass(mark(d.createElement('button'), 'trigger'), 'trigger', rt);
    btn.type = 'button';
    while (headingEl.firstChild) btn.appendChild(headingEl.firstChild);
    if (vci.bool(vci.config(M, 'icon', 'true', rt), true)) {
      var chev = withClass(mark(d.createElement('span'), 'icon'), 'icon', rt);
      chev.setAttribute('aria-hidden', 'true');
      chev.innerHTML = CHEVRON;
      btn.appendChild(chev);
    }
    headingEl.appendChild(btn);

    var body = withClass(mark(d.createElement('div'), 'body'), 'body', rt);
    var inner = withClass(d.createElement('div'), 'inner', rt);
    var text = withClass(d.createElement('div'), 'text', rt);
    inner.appendChild(text);
    body.appendChild(inner);

    var stackClass = cls(rt, 'stack');
    if (stackClass) {
      var stack = d.createElement('div');
      stack.className = stackClass;
      stack.appendChild(headingEl); stack.appendChild(body);
      item.appendChild(stack);
    } else {
      item.appendChild(headingEl); item.appendChild(body);
    }
    return { item: item, body: text };
  }

  function build(rt) {
    if (rt.getAttribute(A('accordion-ready'))) return;
    rt.setAttribute(A('accordion-ready'), '1');
    var SECTION_TAG = vci.config(M, 'section-tag', 'h4', rt);
    var ITEM_TAG = vci.config(M, 'item-tag', 'h5', rt);

    var kids = Array.prototype.slice.call(rt.children);
    var frag = d.createDocumentFragment();
    var section = null, items = null, itemBody = null;

    // Content before the first H1 still gets a section box, so the
    // section + section spacing rule has a sibling to work against.
    function ensureSection() {
      if (section) return;
      section = withClass(mark(d.createElement('div'), 'section'), 'section', rt);
      frag.appendChild(section);
    }
    // Created lazily when the first row of a section appears, which is what
    // keeps intro copy in authored order.
    function ensureItems() {
      ensureSection();
      if (items) return;
      items = mark(d.createElement('div'), 'items');
      items.setAttribute(A(M), 'group');
      section.appendChild(items);
    }

    kids.forEach(function (node) {
      var tag = node.tagName;
      if (tag === 'H1') {
        var titleEl = withClass(mark(retag(node, SECTION_TAG), 'title'), 'title', rt);
        section = withClass(mark(d.createElement('div'), 'section'), 'section', rt);
        section.appendChild(titleEl);
        frag.appendChild(section);
        items = null; itemBody = null;
      } else if (/^H[2-6]$/.test(tag)) {
        ensureItems();
        var built = makeItem(retag(node, ITEM_TAG), rt);
        items.appendChild(built.item);
        itemBody = built.body;
      } else if (tag === 'HR') {
        itemBody = null; items = null;
      } else if (itemBody) {
        itemBody.appendChild(node);
      } else {
        ensureSection();
        section.appendChild(node);
      }
    });

    rt.innerHTML = '';
    rt.appendChild(frag);
    init(rt);
    vci.emit(rt, 'accordion:built', { root: rt });
  }

  vci.ready(function () {
    vci.all(M, 'richtext').forEach(build);
    init();
  });

  return { open: open, close: close, toggle: toggle, init: init, build: build };
});

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

/* narthex/scroll — native smooth anchor scrolling with a header offset.
 *
 * Webflow's own anchor handler (jQuery, "click.wf-scroll") animates the scroll
 * and ignores scroll-margin, so a sticky header covers the target. This turns it
 * off and lets the browser do it: html { scroll-behavior: smooth } plus
 * :target { scroll-margin-top } — which works with keyboard focus, hash
 * navigation and prefers-reduced-motion for free.
 *
 * Opt in on the <script> tag, on <html>, or with vci.settings.scroll = { native: true }:
 *   vci-scroll="native"                turn it on
 *   vci-scroll-offset="…"              CSS length kept clear above the target.
 *                                      Default var(--header-height, 0px), which the
 *                                      nav module's header role fills in.
 *   vci-scroll-webflow="false"         leave Webflow's jQuery handler alone
 */
vci.define('scroll', function (vci) {
  'use strict';
  var w = window, d = document;
  var M = 'scroll';
  var name = vci.attrName(M);

  function enabled() {
    var s = vci.settings.scroll;
    if (s && s.native != null) return vci.bool(s.native, false);
    var tag = d.querySelector('script[' + name + ']');
    if (tag) return tag.getAttribute(name) === 'native';
    return d.documentElement.getAttribute(name) === 'native';
  }

  function apply() {
    if (!enabled()) return false;
    var off = vci.config(M, 'offset', 'var(--header-height, 0px)');
    vci.css('scroll',
      'html{scroll-behavior:smooth}' +
      ':target{scroll-margin-top:' + off + '}' +
      '@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}');
    if (vci.bool(vci.config(M, 'webflow', 'true'), true)) {
      w.Webflow = w.Webflow || [];
      w.Webflow.push(function () {
        var $ = w.jQuery;
        if ($ && $(d).off) $(d).off('click.wf-scroll');
      });
    }
    return true;
  }
  apply();
  return { apply: apply, enabled: enabled };
});

/* narthex/utils — the small ones.
 *
 * NEWTAB   vci-newtab                on a link: opens in a new tab with rel=noopener.
 *                                    on anything else: every a[href] inside it does.
 *          vci-newtab="external"     …but only links to another host.
 *
 * TOGGLE   vci-toggle="trigger"      click toggles a class on its target(s) and
 *                                    keeps aria-expanded in step.
 *          vci-toggle="target"       what gets the class. Pair by vci-toggle-key,
 *                                    or put both inside a vci-toggle="scope" and
 *                                    omit the key. No key and no scope: the
 *                                    trigger toggles itself.
 *          vci-toggle-class          the class. Default is-open.
 *          Events: vci:toggle on the trigger, detail { open, targets }
 *
 * EMPTY    vci-empty="hide"          hides the element when the Collection List
 *                                    inside it renders empty (.w-dyn-empty). CSS
 *                                    :has() — no JS runs, so the Designer canvas
 *                                    (where custom code never runs) keeps it visible.
 */
vci.define('newtab', function (vci) {
  'use strict';
  var M = 'newtab', loc = window.location;
  function external(a) { try { return new URL(a.href, loc.href).host !== loc.host; } catch (e) { return false; } }
  function mark(a, onlyExternal) {
    if (onlyExternal && !external(a)) return;
    a.target = '_blank';
    var rel = (a.rel || '').split(/\s+/).filter(Boolean);
    if (rel.indexOf('noopener') < 0) rel.push('noopener');
    if (rel.indexOf('noreferrer') < 0) rel.push('noreferrer');
    a.rel = rel.join(' ');
  }
  function init(root) {
    vci.all(M, null, root).forEach(function (el) {
      var onlyExternal = vci.attr(el, M) === 'external';
      if (el.matches('a[href]')) mark(el, onlyExternal);
      else Array.prototype.forEach.call(el.querySelectorAll('a[href]'), function (a) { mark(a, onlyExternal); });
    });
  }
  vci.ready(function () { init(); });
  return { init: init };
});

vci.define('toggle', function (vci) {
  'use strict';
  var d = document, M = 'toggle';
  function targetsOf(trig) {
    var k = vci.attr(trig, 'toggle-key');
    if (k) return vci.all(M, 'target').filter(function (t) { return vci.attr(t, 'toggle-key') === k; });
    var scope = vci.closest(trig.parentNode, M, 'scope');
    if (scope) return vci.all(M, 'target', scope);
    return [trig];
  }
  function set(trig, open) {
    var cls = vci.config(M, 'class', 'is-open', trig);
    var targets = targetsOf(trig);
    targets.forEach(function (t) { t.classList.toggle(cls, open); });
    trig.setAttribute('aria-expanded', String(open));
    vci.emit(trig, 'toggle', { open: open, targets: targets });
    return open;
  }
  function isOpen(trig) { return trig.getAttribute('aria-expanded') === 'true'; }
  d.addEventListener('click', function (e) {
    var trig = vci.closest(e.target, M, 'trigger');
    if (!trig) return;
    e.preventDefault();
    set(trig, !isOpen(trig));
  });
  d.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var trig = vci.closest(e.target, M, 'trigger');
    if (!trig || trig.matches('button, a[href]')) return;
    e.preventDefault(); trig.click();
  });
  vci.ready(function () {
    vci.all(M, 'trigger').forEach(function (trig) {
      var cls = vci.config(M, 'class', 'is-open', trig);
      var open = targetsOf(trig).some(function (t) { return t.classList.contains(cls); });
      trig.setAttribute('aria-expanded', String(open));
      if (!trig.matches('button, a[href], [tabindex]')) { trig.setAttribute('role', 'button'); trig.setAttribute('tabindex', '0'); }
    });
  });
  return { open: function (t) { return set(t, true); }, close: function (t) { return set(t, false); }, toggle: function (t) { return set(t, !isOpen(t)); } };
});

vci.define('empty', function (vci) {
  'use strict';
  vci.css('empty', vci.sel('empty', 'hide') + ':has(.w-dyn-empty){display:none}');
  return {};
});

/* narthex/fslist — two helpers for Finsweet Attributes v2 "list" filters.
 *
 * LABEL VALUE   vci-fslist="label-value" on a wrapper (the filter form, a group)
 *               Webflow checkboxes and radios cannot CMS-bind an attribute
 *               value, so this copies each option's label text into fs-list-value
 *               before Finsweet initialises. Runs the moment this script executes,
 *               which is why narthex must load as a plain (not async/defer) script
 *               ahead of Finsweet's — Finsweet's is a deferred module, so a plain
 *               script placed anywhere in the footer beats it.
 *
 * DEEP LINK     vci-fslist="deeplink" vci-fslist-param="series" on a wrapper
 *               Reads ?series=<Name> from the URL and ticks the option inside the
 *               wrapper whose fs-list-value (or label text) matches, case-
 *               insensitively, once Finsweet's list module is ready — so the click
 *               registers as a filter. Add vci-fslist-field="ministry" to only
 *               consider inputs with that fs-list-field. Polls as a backstop in
 *               case Finsweet's callback never fires.
 *
 * EVENTS  vci:fslist:deeplink on the wrapper, detail { param, value, input }
 *         (input is null when nothing matched — it also logs an error)
 */
vci.define('fslist', function (vci) {
  'use strict';
  var w = window, d = document;
  var M = 'fslist';
  var INPUTS = 'input[type="checkbox"], input[type="radio"]';

  function labelText(input) {
    var l = input.closest('label') || (input.id && d.querySelector('label[for="' + input.id + '"]'));
    return l ? l.textContent.trim() : '';
  }
  function labelValue(root) {
    vci.all(M, 'label-value', root).forEach(function (wrap) {
      Array.prototype.forEach.call(wrap.querySelectorAll(INPUTS), function (cb) {
        var text = labelText(cb);
        if (text && !cb.hasAttribute('fs-list-value')) cb.setAttribute('fs-list-value', text);
      });
    });
  }

  function deeplink() {
    var qs = new URLSearchParams(w.location.search);
    vci.all(M, 'deeplink').forEach(function (wrap) {
      var param = vci.attr(wrap, 'fslist-param');
      var value = param && qs.get(param);
      if (!value) return;
      var field = vci.attr(wrap, 'fslist-field');
      function find() {
        var hit = null;
        Array.prototype.forEach.call(wrap.querySelectorAll(INPUTS), function (cb) {
          if (field && cb.getAttribute('fs-list-field') !== field) return;
          var v = cb.getAttribute('fs-list-value') || labelText(cb);
          if (v && v.toLowerCase() === value.toLowerCase()) hit = cb;
        });
        return hit;
      }
      var done = false;
      function apply() {
        if (done) return true;
        var cb = find();
        if (!cb) return false;
        done = true;
        if (!cb.checked) cb.click();
        vci.emit(wrap, 'fslist:deeplink', { param: param, value: value, input: cb });
        return true;
      }
      w.FinsweetAttributes = w.FinsweetAttributes || [];
      w.FinsweetAttributes.push(['list', function () {
        if (!apply()) {
          console.error('[' + vci.prefix + ' fslist] no option matches ?' + param + '=' + value);
          vci.emit(wrap, 'fslist:deeplink', { param: param, value: value, input: null });
        }
      }]);
      var tries = 0;
      (function poll() { if (apply() || ++tries > 20) return; setTimeout(poll, 500); })();
    });
  }

  // label-value must beat Finsweet, so it runs now AND again on ready
  // (for markup that lands later, e.g. a build that loads narthex in <head>).
  labelValue();
  vci.ready(function () { labelValue(); deeplink(); });

  return { labelValue: labelValue, deeplink: deeplink };
});

/* narthex/livestream — reveal a link and fill players when a YouTube channel is live.
 *
 * ROLES  (vci-livestream="…")
 *   link     an <a> kept hidden until the channel is confirmed live, then pointed
 *            at the watch URL and revealed.
 *   embed    a container holding exactly one <iframe>. Filled with a muted,
 *            chromeless, autoplaying background player, faded in once YouTube's
 *            startup chrome has cleared — for a hero notice.
 *   player   a container holding one <iframe>. A real player the visitor drives.
 *            Off-air it shows YouTube's own channel live-stream card (which
 *            costs no search quota), so a /live page is never an empty box.
 *
 * SETTINGS (vci-livestream-<setting>, on the <script> tag / vci.settings.livestream / <html>)
 *   key      YouTube Data API v3 key (referrer-restricted in Google Cloud). Required.
 *   handle   channel handle, with or without @. Required.
 *   days     days the live check runs, comma list of sun,mon,… or "all". Default sun.
 *   tz       IANA zone the days are judged in. Default America/Chicago.
 *   test     query-string flag that forces the check any day. Default livestream=test.
 *   cache    minutes to cache the live result per session. Default 5.
 *
 * QUOTA — the reason this is shaped the way it is. channels.list costs 1 unit,
 * search.list 100, against a 10,000/day PROJECT ceiling shared by every visitor.
 * So: the channel id is cached in localStorage forever, the search result per
 * session, and the search only runs on the configured days. Even so a busy
 * morning can spend it; the fix then is a cached server-side check, not a
 * bigger number here.
 *
 * EVENTS  vci:livestream:live on document, detail { videoId } · vci:livestream:offline
 */
vci.define('livestream', function (vci) {
  'use strict';
  var w = window, d = document;
  var M = 'livestream';
  var TAG = '[' + vci.prefix + ' livestream]';
  var DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

  function cacheGet(store, key) { try { return store.getItem(key); } catch (e) { return null; } }
  function cacheSet(store, key, value) { try { store.setItem(key, value); } catch (e) {} }

  function run() {
    var links = vci.all(M, 'link');
    var embeds = vci.all(M, 'embed');
    var players = vci.all(M, 'player');
    // Ships on every page; most pages use none of the hooks and should cost nothing.
    if (!links.length && !embeds.length && !players.length) return;

    // Hidden in JS rather than CSS so the notice still renders on the Designer canvas.
    links.forEach(function (l) { l.style.display = 'none'; });

    var KEY = String(vci.config(M, 'key', '')).trim();
    var HANDLE = String(vci.config(M, 'handle', '')).trim().replace(/^@/, '');
    if (!KEY) { console.error(TAG + ' vci-livestream-key is empty.'); return; }
    if (!HANDLE) { console.error(TAG + ' vci-livestream-handle is empty.'); return; }

    var testFlag = vci.config(M, 'test', 'livestream=test');
    var force = w.location.search.slice(1).split('&').indexOf(testFlag) > -1;
    var days = vci.list(vci.config(M, 'days', 'sun')).map(function (s) { return s.toLowerCase().slice(0, 3); });
    var today = new Intl.DateTimeFormat('en-US', { timeZone: vci.config(M, 'tz', 'America/Chicago'), weekday: 'short' })
      .format(new Date()).toLowerCase();
    var checkLive = force || days.indexOf('all') > -1 || days.indexOf(today) > -1;
    if (!checkLive && !players.length) return;

    function api(path, params) {
      params.key = KEY;
      var url = 'https://www.googleapis.com/youtube/v3/' + path + '?' + new URLSearchParams(params).toString();
      return fetch(url).then(function (res) {
        if (res.ok) return res.json();
        return res.text().then(function (body) {
          console.error(TAG + ' YouTube ' + path + ' returned ' + res.status +
            (res.status === 403 ? ' — either the daily quota is spent or the API key\u2019s HTTP-referrer restrictions reject this domain.' : ''), body);
          return null;
        });
      });
    }
    function channelId() {
      var ck = vci.prefix + '-yt-channel-' + HANDLE;
      var cached = cacheGet(w.localStorage, ck);
      if (cached) return Promise.resolve(cached);
      return api('channels', { part: 'id', forHandle: HANDLE }).then(function (ch) {
        if (!ch) return null;
        var id = ch.items && ch.items[0] && ch.items[0].id;
        if (!id) { console.error(TAG + ' no channel found for handle @' + HANDLE + '.'); return null; }
        cacheSet(w.localStorage, ck, id);
        return id;
      });
    }
    function liveVideoId(id) {
      var ck = vci.prefix + '-yt-live';
      var cached = cacheGet(w.sessionStorage, ck);
      if (cached) {
        var parts = cached.split('|');
        if (Number(parts[0]) > Date.now()) return Promise.resolve(parts[1] || null);
      }
      return api('search', { part: 'snippet', channelId: id, eventType: 'live', type: 'video', maxResults: '1' })
        .then(function (live) {
          if (!live) return null;
          var item = live.items && live.items[0];
          var videoId = (item && item.id && item.id.videoId) || '';
          var ttl = vci.num(vci.config(M, 'cache', '5'), 5) * 60 * 1000;
          cacheSet(w.sessionStorage, ck, (Date.now() + ttl) + '|' + videoId);
          return videoId || null;
        });
    }
    function whenPlayerReady(cb) {
      if (w.YT && w.YT.Player) { cb(); return; }
      var prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = function () { if (typeof prev === 'function') prev(); cb(); };
      if (!d.getElementById('yt-iframe-api')) {
        var s = d.createElement('script');
        s.id = 'yt-iframe-api';
        s.src = 'https://www.youtube.com/iframe_api';
        d.head.appendChild(s);
      }
    }
    function fallbackToLink(container) {
      var box = container.firstElementChild || container;
      box.innerHTML = '<a href="https://www.youtube.com/@' + HANDLE + '/live" target="_blank" rel="noopener" ' +
        'style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;text-align:center;padding:1rem;">Watch on YouTube</a>';
    }
    function iframeIn(container) {
      var f = container.querySelector('iframe');
      if (!f) console.error(TAG + ' container has no <iframe> inside it.', container);
      return f;
    }

    channelId().then(function (id) {
      if (!id) { players.forEach(fallbackToLink); return null; }
      players.forEach(function (c) {
        var f = iframeIn(c);
        if (f && !f.src) f.src = 'https://www.youtube.com/embed/live_stream?channel=' + id;
      });
      if (!checkLive) return null;
      return liveVideoId(id);
    }).then(function (videoId) {
      if (!videoId) {
        if (checkLive) { vci.log('nothing live right now — link stays hidden.'); vci.emit(d, 'livestream:offline', {}); }
        return;
      }
      vci.emit(d, 'livestream:live', { videoId: videoId });
      links.forEach(function (l) { l.href = 'https://www.youtube.com/watch?v=' + videoId; l.style.display = ''; });
      players.forEach(function (c) {
        var f = iframeIn(c);
        if (f) { c.style.display = ''; f.src = 'https://www.youtube.com/embed/' + videoId + '?rel=0&playsinline=1'; }
      });
      embeds.forEach(function (c) {
        var f = iframeIn(c);
        if (!f) return;
        c.style.display = '';
        f.style.opacity = '0';
        f.style.transition = 'opacity 300ms ease';
        f.src = 'https://www.youtube.com/embed/' + videoId + '?autoplay=1&mute=1&controls=0&rel=0&playsinline=1&enablejsapi=1';
        whenPlayerReady(function () {
          new w.YT.Player(f, { events: {
            onReady: function (e) { e.target.mute(); e.target.playVideo(); },
            onStateChange: function (e) {
              if (e.data === w.YT.PlayerState.PLAYING) setTimeout(function () { f.style.opacity = '1'; }, 6000);
            }
          } });
        });
      });
    }).catch(function (err) { console.error(TAG + ' check failed:', err); });
  }

  vci.ready(run);
  return { run: run };
});

/* narthex/shadow-css — load a stylesheet INSIDE web components' open shadow roots.
 *
 * Third-party widgets that render into an open shadow root (MinistryPlatform's
 * <mpp-*> widgets, for one) cannot be reached by page CSS or the Designer style
 * panel. A <link> appended inside the shadow root can.
 *
 * Two ways to say which elements:
 *   per element    <mpp-event-details vci-shadow-css="https://…/theme.css">
 *   per tag list   <script … vci-shadow-css="https://…/theme.css"
 *                            vci-shadow-css-tags="mpp-event-details,mpp-checkout">
 *                  (or vci.settings["shadow-css"] = { url, tags }, or the same
 *                  attributes on <html>)
 *
 * Attaching a shadow root is not a light-DOM mutation and fires no observer
 * callback, so this sweeps on an interval for the first fifteen seconds as well
 * as on every DOM mutation. Each root gets each URL once.
 *
 * SETTINGS   url · tags · poll (ms, default 250) · tries (default 60)
 * API        vci["shadow-css"].sweep()
 */
vci.define('shadow-css', function (vci) {
  'use strict';
  var d = document;
  var M = 'shadow-css';
  var MARK = vci.attrName('shadow-css-link');

  function inject(el, href) {
    var r = el.shadowRoot;
    if (!r || !href) return false;
    var esc = href.replace(/["\\]/g, '\\$&');
    if (r.querySelector('link[' + MARK + '="' + esc + '"]')) return false;
    var l = d.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    l.setAttribute(MARK, href);
    r.appendChild(l);
    return true;
  }

  function sweep() {
    vci.all(M).forEach(function (el) { inject(el, vci.attr(el, M)); });
    var url = vci.config(M, 'url', '') || (function () {
      var tag = d.querySelector('script[' + vci.attrName(M) + ']');
      return tag ? tag.getAttribute(vci.attrName(M)) : d.documentElement.getAttribute(vci.attrName(M));
    })();
    var tags = vci.list(vci.config(M, 'tags', ''));
    if (url && tags.length) {
      Array.prototype.forEach.call(d.querySelectorAll(tags.join(',')), function (el) { inject(el, url); });
    }
  }

  vci.ready(function () {
    sweep();
    var tries = vci.num(vci.config(M, 'tries', '60'), 60), t = 0;
    var id = setInterval(function () { sweep(); if (++t >= tries) clearInterval(id); },
      vci.num(vci.config(M, 'poll', '250'), 250));
    new MutationObserver(sweep).observe(d.documentElement, { childList: true, subtree: true });
  });

  return { sweep: sweep, inject: inject };
});
