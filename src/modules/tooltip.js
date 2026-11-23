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
