/*! narthex v0.1.0 — utils — https://github.com/volentecreative/narthex
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
