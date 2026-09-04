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
