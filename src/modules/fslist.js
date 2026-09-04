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
