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
