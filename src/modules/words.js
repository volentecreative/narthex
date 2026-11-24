/* narthex/words — staggered word-by-word reveal for a large line of text.
 *
 * Splits the text inside the element into words and brings them in one after
 * another the first time the element scrolls into view: each word fades in and
 * rises a short distance into place. Markup inside is kept as it is — links,
 * spans with classes, icons — only the bare text is split, so a phrase wrapped
 * in a no-wrap span still never breaks. An inline <svg> or <img> counts as one
 * word, so an icon arrives in turn with the word beside it.
 *
 * ROLE  vci-words="reveal"   on the heading or paragraph to animate
 *
 * SETTINGS  (vci-words-<setting>, on the element or any ancestor)
 *   stagger    ms between words. Default 45.
 *   duration   ms each word takes. Default 700.
 *   rise       CSS length each word rises from. Default 0.45em.
 *   easing     Default cubic-bezier(.2,.7,.2,1).
 *   threshold  0..1 of the element in view before it starts. Default 0.35.
 *   class      class added to the element once every word is in. Default is-revealed.
 *
 * EVENTS  vci:words:start and vci:words:done on the element, detail { units }
 *         — hook further animation (an icon drawing itself) onto these.
 *
 * Safe by construction: nothing is hidden unless this runs; reduced motion and
 * browsers without IntersectionObserver / Web Animations get the plain text;
 * only opacity and transform animate. Each word is an inline-block span marked
 * vci-words-unit; spaces stay real text so wrapping and copy/paste are normal.
 */
vci.define('words', function (vci) {
  'use strict';
  var w = window, d = document;
  var M = 'words';
  var UNIT = vci.attrName('words-unit');
  var motionOk = !!(w.IntersectionObserver && Element.prototype.animate) &&
    !(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);

  function split(el) {
    var units = [];
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var parts = n.textContent.split(/(\s+)/);
          if (parts.length < 2 && !parts[0].trim()) return;
          var frag = d.createDocumentFragment();
          parts.forEach(function (p) {
            if (!p) return;
            if (/^\s+$/.test(p)) { frag.appendChild(d.createTextNode(p)); return; }
            var s = d.createElement('span');
            s.setAttribute(UNIT, '');
            s.style.display = 'inline-block';
            s.textContent = p;
            frag.appendChild(s);
            units.push(s);
          });
          n.parentNode.replaceChild(frag, n);
        } else if (n.nodeType === 1) {
          var tag = n.tagName.toLowerCase();
          if (tag === 'svg' || tag === 'img') { units.push(n); return; }
          if (n.hasAttribute(UNIT)) { units.push(n); return; }
          walk(n);
        }
      });
    })(el);
    return units;
  }

  function play(el, units) {
    var stagger = vci.num(vci.config(M, 'stagger', 45, el), 45);
    var dur = vci.num(vci.config(M, 'duration', 700, el), 700);
    var rise = vci.config(M, 'rise', '0.45em', el);
    var ease = vci.config(M, 'easing', 'cubic-bezier(.2,.7,.2,1)', el);
    var cls = vci.config(M, 'class', 'is-revealed', el);
    vci.emit(el, 'words:start', { units: units });
    var last = null;
    units.forEach(function (u, i) {
      last = u.animate(
        [{ opacity: 0, transform: 'translateY(' + rise + ')' }, { opacity: 1, transform: 'none' }],
        { duration: dur, delay: i * stagger, easing: ease, fill: 'backwards' });
      u.style.opacity = '';
    });
    var finish = function () { el.classList.add(cls); vci.emit(el, 'words:done', { units: units }); };
    if (last) last.onfinish = finish; else finish();
  }

  function init(el) {
    if (el.__vciWords) return;
    el.__vciWords = true;
    var units = split(el);
    if (!motionOk || !units.length) return;
    units.forEach(function (u) { u.style.opacity = '0'; });
    var threshold = vci.num(vci.config(M, 'threshold', 0.35, el), 0.35);
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.disconnect();
        play(el, units);
      });
    }, { threshold: threshold });
    io.observe(el);
    // Anything that needs it visible right now (find-in-page, focus, print) gets it.
    var reveal = function () { io.disconnect(); units.forEach(function (u) { u.style.opacity = ''; }); };
    el.addEventListener('focusin', reveal, { once: true });
    w.addEventListener('beforeprint', reveal, { once: true });
  }

  function scan(root) { vci.all(M, 'reveal', root).forEach(init); }
  vci.ready(function () { scan(); });
  return { scan: scan, split: split };
});
