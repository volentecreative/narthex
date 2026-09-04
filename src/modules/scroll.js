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
