/*! narthex v0.1.0 — fslist — https://github.com/volentecreative/narthex
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
