/* narthex/image — right-sized responsive images.
 *
 * Webflow writes a srcset on every image but a sizes value that is a guess
 * (often "100vw"), so a phone downloads a far larger file than the slot the
 * image sits in. This sets each image's sizes to the width it is actually
 * rendered at, so the browser picks the smallest srcset file that fits.
 *
 * It has to get there before the image starts loading, so load it in the
 * <head> (not deferred): it then catches each <img> as the parser adds it.
 * Loaded in the footer it still helps every image that has not started yet
 * (lazy images below the fold, anything added later) and leaves the rest alone.
 *
 * Opt in on the <script> tag, on <html>, or with vci.settings.image = { sizes: true }:
 *   vci-image="sizes"          turn it on for the page
 *
 * SETTINGS (vci-image-<setting>)
 *   skip   "true" on an image, or any ancestor, to leave its sizes alone.
 *
 * What it does to an image, once: sets the sizes attribute to "<n>px", where n
 * is the rendered width (for object-fit: cover, the longer rendered side, since
 * the file has to cover the box). An image with no layout yet is watched until
 * it has one. A changed srcset is measured again. On resize, sizes only ever
 * grows: a file already downloaded is never swapped for a smaller one.
 *
 * EVENTS  vci:image:sized on the image, detail { image, width }
 * API     vci.image.enabled() · scan(root?) · fix(img)
 */
vci.define('image', function (vci) {
  'use strict';
  var w = window, d = document;
  var M = 'image';
  var name = vci.attrName(M);
  var supported = !!(w.WeakSet && w.MutationObserver);
  var done = supported ? new WeakSet() : null;
  var ro = supported && w.ResizeObserver ? new ResizeObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.contentRect.width && fix(e.target)) ro.unobserve(e.target);
    });
  }) : null;

  function enabled() {
    if (!supported) return false;
    var s = vci.settings[M];
    if (s && s.sizes != null) return vci.bool(s.sizes, false);
    var tag = d.querySelector('script[' + name + ']');
    if (tag) return tag.getAttribute(name) === 'sizes';
    return d.documentElement.getAttribute(name) === 'sizes';
  }

  // Rendered width the file has to fill, in CSS px. 0 = no layout yet.
  function need(img) {
    var r = img.getBoundingClientRect();
    if (!r.width || !r.height) return 0;
    return Math.ceil(getComputedStyle(img).objectFit === 'cover' ? Math.max(r.width, r.height) : r.width);
  }

  // True when there is nothing more to do for this image (sized, already
  // loaded, skipped, or not responsive); false when it is waiting for layout.
  function fix(img) {
    if (!supported || !img.srcset || done.has(img)) return true;
    if (img.complete && img.currentSrc) return true; // already downloaded: too late to help
    if (vci.bool(vci.config(M, 'skip', 'false', img), false)) return true;
    var width = need(img);
    if (!width) {
      if (ro) ro.observe(img);
      return false;
    }
    img.sizes = width + 'px';
    done.add(img);
    vci.emit(img, M + ':sized', { image: img, width: width });
    return true;
  }

  function scan(root) {
    root = root || d;
    if (root.tagName === 'IMG') fix(root);
    if (root.querySelectorAll) Array.prototype.forEach.call(root.querySelectorAll('img[srcset]'), fix);
  }

  function start() {
    new MutationObserver(function (records) {
      records.forEach(function (m) {
        if (m.type === 'attributes') {
          done['delete'](m.target);
          fix(m.target);
          return;
        }
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType === 1) scan(n);
        });
      });
    }).observe(d.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['srcset'] });

    vci.ready(function () { scan(d); });

    var timer;
    w.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () {
        Array.prototype.forEach.call(d.querySelectorAll('img[srcset]'), function (img) {
          var width = need(img);
          if (width && done.has(img) && width > parseInt(img.sizes, 10)) {
            img.sizes = width + 'px';
            vci.emit(img, M + ':sized', { image: img, width: width });
          }
        });
      }, 200);
    });
  }

  if (enabled()) start();
  return { enabled: enabled, scan: scan, fix: fix };
});
