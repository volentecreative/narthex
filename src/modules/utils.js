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
