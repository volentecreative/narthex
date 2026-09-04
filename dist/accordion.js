/*! narthex v0.1.1 — accordion — https://github.com/volentecreative/narthex
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
 *               empty line    does the same (Webflow's editor makes an <hr> awkward
 *                             to insert; a blank paragraph is what editors can type).
 *                             Empty means no text — an image or embed on its own line
 *                             is content. Turn off with vci-accordion-blank="false".
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
  // Webflow writes a non-breaking space into a blank paragraph; strip it
  // before trimming. Media on its own line is content, not a separator.
  function isBlank(node) {
    if (node.querySelector && node.querySelector('img, iframe, video, figure, picture, svg, hr')) return false;
    return !node.textContent.replace(/\u00a0/g, ' ').trim();
  }
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
    var BLANK = vci.bool(vci.config(M, 'blank', 'true', rt), true);

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
      } else if (tag === 'HR' || (BLANK && isBlank(node))) {
        // Either marker closes the open row and is dropped from the output.
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
