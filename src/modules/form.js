/* narthex/form — live field validation, and Cloudflare Turnstile, on any form.
 *
 * ROLES  (vci-form="…")
 *   form       a <form>, or a wrapper with one inside (a Webflow Form Block).
 *              Every input, select and textarea in it that has a name is
 *              validated, by the browser's own rules (required, type, pattern,
 *              minlength…) plus the few below.
 *   field      the wrapper around one control, its label and its message.
 *              Receives the state class along with the control. Optional:
 *              without one, the message has to be a sibling of the control.
 *   message    inside a field: its text becomes the valid text, or the reason
 *              the value is not valid, and empty while neither shows. It gets
 *              aria-live, and the control points at it with aria-describedby.
 *   turnstile  where the Turnstile widget renders. Needs vci-form-sitekey.
 *              A submit waits for its token. If it sits in a field, that
 *              field's message says why a submit is waiting.
 *
 * SETTINGS (vci-form-<setting>, on the element or any ancestor / <script> / vci.settings.form)
 *   valid-class     state class on a valid control, its field and message. Default is-valid.
 *   invalid-class   the same for a value that is not valid. Default is-invalid.
 *   valid-text      what the message says when the value is good. Default "Valid".
 *                   Settings resolve through ancestors, so it can sit on the form
 *                   and be overridden on one field.
 *   invalid-text    what it says when it is not. Default: the browser's own
 *                   validationMessage, which names the actual problem.
 *   email           "strict" (default) also wants a dot in the domain
 *                   (name@host.tld); the browser alone accepts name@host.
 *                   "native" leaves email to the browser.
 *   sitekey         the Turnstile site key. Public; it belongs in the page.
 *   theme           Turnstile theme: auto / light / dark. Default auto. Read each
 *                   time the widget comes into view, and re-rendered if it
 *                   changed (while it holds no token) — so a site with its own
 *                   light/dark switch can set this on <html> and keep it current.
 *   size            Turnstile size: normal / flexible / compact. Default flexible.
 *   appearance      Turnstile appearance: always / execute / interaction-only. Default always.
 *   action          Turnstile action, for its analytics and a server's siteverify check.
 *   response-field  name of the hidden token input Turnstile adds to the form, or
 *                   "false" for none. Default cf-turnstile-response. A backend that
 *                   verifies the token needs it; a form handler that does not
 *                   (Webflow's own) would only store it as one more field.
 *   render          "visible" (default): load Turnstile when its element first
 *                   comes into view, so a form in a closed modal costs nothing
 *                   until it is opened. "load": on page load.
 *   wait-text       message while a submit waits on the check. Default "Verifying…".
 *   error-text      message when the check fails. Default
 *                   "The security check did not pass. Reload the page and try again."
 *
 * WHEN STATES SHOW. Valid shows the moment the value is good, while typing.
 * Invalid waits until the field has been edited and left, or a submit was
 * tried, so nothing scolds a half-typed address; after that it updates live.
 * An empty optional field shows neither. Each field also carries
 * vci-form-state="valid" / "invalid" for CSS that would rather key off that.
 *
 * SUBMIT. The form gets novalidate: the messages replace the browser's bubbles.
 * A submit with anything invalid is stopped before every other handler
 * (Webflow's included), every field shows its state and focus goes to the
 * first bad one. A submit before the Turnstile token arrives waits and goes
 * through by itself when it does. A token is good once, so after a submit goes
 * through the widget is marked spent, and the next submit (a retry after a
 * failed send) gets a fresh one first.
 *
 * Turnstile in the browser stops bots that drive the form. One that posts
 * straight to the form's endpoint is only stopped by a server that checks the
 * token with Cloudflare's siteverify — the form's own backend, not narthex.
 *
 * EVENTS  on the control: vci:form:valid / vci:form:invalid, detail { control, field, message, form }.
 *         on the form: vci:form:blocked { form, reason: 'invalid' | 'turnstile', controls },
 *         vci:form:verified { form, token }, vci:form:submit { form, token },
 *         vci:form:error { form, code } (Turnstile failed).
 * API     vci.form.validate(formOrControl, show?) → boolean · reset(form)
 *         · token(form) · refresh(form) (re-render the widget, e.g. after a theme change)
 */
vci.define('form', function (vci) {
  'use strict';
  var d = document, w = window, F = 'form';
  var A = vci.attrName;
  var API = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  // name@host.tld: no spaces, one @, a dot in the domain, a 2+ letter last part.
  var EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;
  var SKIP = { hidden: 1, submit: 1, button: 1, reset: 1, image: 1 };

  var dirty = new WeakMap();    // control -> edited since load / reset
  var touched = new WeakMap();  // control -> left after editing, or a submit tried
  var shown = new WeakMap();    // control -> '' | 'valid' | 'invalid'
  var widgets = new WeakMap();  // turnstile el -> { id, theme, token, spent, pending }
  var waiting = new WeakMap();  // form -> the submitter of a submit held for the token
  var ready = new WeakMap();    // form -> prepared
  var uid = 0;

  /* ---------- lookups ---------- */
  function formOf(el) {
    if (!el || !el.closest) return null;
    if (el.tagName !== 'FORM' && vci.role(el, F) === 'form') el = el.querySelector('form') || el;
    var f = el.tagName === 'FORM' ? el : el.closest('form');
    return f && vci.closest(f, F, 'form') ? f : null;
  }
  function isControl(el) {
    if (!el || !el.name || el.disabled) return false;
    var tag = el.tagName;
    if (tag !== 'INPUT' && tag !== 'SELECT' && tag !== 'TEXTAREA') return false;
    if (tag === 'INPUT' && SKIP[el.type]) return false;
    return !vci.closest(el, F, 'turnstile');
  }
  function controls(f) {
    return Array.prototype.filter.call(f.elements, isControl);
  }
  function fieldOf(el) { return vci.closest(el, F, 'field'); }
  function messageOf(el) {
    var fld = fieldOf(el);
    if (fld) return fld.querySelector(vci.sel(F, 'message'));
    var p = el.parentElement;
    for (var n = p && p.firstElementChild; n; n = n.nextElementSibling) {
      if (vci.role(n, F) === 'message') return n;
    }
    return null;
  }
  function turnstileOf(f) {
    var host = vci.closest(f, F, 'form') || f;
    return host.querySelector(vci.sel(F, 'turnstile'));
  }

  /* ---------- validation ---------- */
  function isEmpty(c) {
    if (c.type === 'checkbox' || c.type === 'radio') {
      if (c.type === 'radio' && c.form && c.name) {
        return !c.form.querySelector('input[type="radio"][name="' + cssEsc(c.name) + '"]:checked');
      }
      return !c.checked;
    }
    return !String(c.value || '').trim();
  }
  function cssEsc(s) { return w.CSS && CSS.escape ? CSS.escape(s) : s.replace(/["\\]/g, '\\$&'); }

  // The browser's verdict, plus the gaps it leaves: a required field of only
  // spaces passes natively, and so does name@host.
  function check(c) {
    if (!c.setCustomValidity) return true;
    c.setCustomValidity('');
    var v = typeof c.value === 'string' ? c.value : '';
    if (c.required && v && !v.trim()) {
      c.setCustomValidity('Please fill out this field.');
    } else if (c.type === 'email' && v && c.validity.valid &&
               vci.config(F, 'email', 'strict', c) !== 'native' && !EMAIL.test(v.trim())) {
      c.setCustomValidity('Please enter an email address like name@example.com.');
    }
    return c.validity.valid;
  }

  function setText(m, t) { if (m && m.textContent !== t) m.textContent = t; }

  function paint(c, force) {
    var valid = check(c);
    var st;
    if (valid) st = isEmpty(c) ? '' : 'valid';
    else st = (force || touched.get(c) || shown.get(c) === 'invalid') ? 'invalid' : '';
    if (force) touched.set(c, true);
    var fld = fieldOf(c), msg = messageOf(c);
    var vc = vci.config(F, 'valid-class', 'is-valid', c);
    var ic = vci.config(F, 'invalid-class', 'is-invalid', c);
    [c, fld, msg].forEach(function (el) {
      if (!el) return;
      el.classList.toggle(vc, st === 'valid');
      el.classList.toggle(ic, st === 'invalid');
    });
    if (fld) {
      if (st) fld.setAttribute(A('form-state'), st);
      else fld.removeAttribute(A('form-state'));
    }
    if (st === 'invalid') c.setAttribute('aria-invalid', 'true');
    else c.removeAttribute('aria-invalid');
    setText(msg, st === 'valid' ? vci.config(F, 'valid-text', 'Valid', c)
      : st === 'invalid' ? (vci.config(F, 'invalid-text', '', c) || c.validationMessage) : '');
    if (st !== (shown.get(c) || '')) {
      shown.set(c, st);
      if (st) vci.emit(c, 'form:' + st, { control: c, field: fld, message: msg, form: c.form });
    }
    return valid;
  }

  function prepare(f) {
    if (!f || ready.has(f)) return;
    ready.set(f, true);
    f.noValidate = true;
    controls(f).forEach(function (c) {
      var msg = messageOf(c);
      if (msg) {
        if (!msg.id) msg.id = 'vci-form-msg-' + (++uid);
        msg.setAttribute('aria-live', 'polite');
        var by = (c.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
        if (by.indexOf(msg.id) < 0) { by.push(msg.id); c.setAttribute('aria-describedby', by.join(' ')); }
      }
      // A value already there (autofill, back navigation) counts as typed.
      if (!isEmpty(c)) paint(c);
    });
    var t = turnstileOf(f);
    if (t) {
      var m = messageOf(t);
      if (m) m.setAttribute('aria-live', 'polite');
      armTurnstile(t);
    }
  }

  /* ---------- Turnstile ---------- */
  var loading = null, queue = [];
  function withApi(cb) {
    if (w.turnstile && w.turnstile.render) { cb(w.turnstile); return; }
    queue.push(cb);
    if (loading) return;
    var flush = function () {
      var q = queue; queue = [];
      q.forEach(function (fn) { fn(w.turnstile); });
    };
    var fail = function () {
      var q = queue; queue = [];
      q.forEach(function (fn) { fn(null); });
      loading = null;
    };
    // Someone else's tag (implicit rendering for another widget) is fine to
    // share: wait for it instead of loading the script twice.
    loading = d.querySelector('script[src^="' + API + '"]');
    if (loading) {
      loading.addEventListener('load', function () {
        if (w.turnstile && w.turnstile.ready) w.turnstile.ready(flush); else flush();
      });
      loading.addEventListener('error', fail);
      return;
    }
    w.vciTurnstileOnload = flush;
    loading = d.createElement('script');
    loading.src = API + '?render=explicit&onload=vciTurnstileOnload';
    loading.async = true;
    loading.defer = true;
    loading.addEventListener('error', fail);
    (d.head || d.documentElement).appendChild(loading);
  }

  function tsMessage(t, text, bad) {
    var m = messageOf(t);
    if (!m) return;
    setText(m, text);
    var ic = vci.config(F, 'invalid-class', 'is-invalid', t);
    m.classList.toggle(ic, !!bad);
    var fld = fieldOf(t);
    if (fld) fld.classList.toggle(ic, !!bad);
  }

  function render(t) {
    var st = widgets.get(t);
    var theme = vci.config(F, 'theme', 'auto', t);
    if (st && (st.pending || st.theme === theme || (st.token && !st.spent))) return;
    var key = vci.config(F, 'sitekey', '', t);
    if (!key) { vci.warn('form: a turnstile element needs vci-form-sitekey', t); return; }
    var old = st;
    st = { id: null, theme: theme, token: null, spent: false, pending: true };
    widgets.set(t, st);
    withApi(function (ts) {
      st.pending = false;
      var f = formOf(t);
      if (!ts) {
        tsMessage(t, vci.config(F, 'error-text', 'The security check did not pass. Reload the page and try again.', t), true);
        vci.emit(f || t, 'form:error', { form: f, code: 'script' });
        return;
      }
      if (old && old.id != null) { try { ts.remove(old.id); } catch (x) {} }
      var opts = {
        sitekey: key,
        theme: theme,
        size: vci.config(F, 'size', 'flexible', t),
        appearance: vci.config(F, 'appearance', 'always', t),
        callback: function (tok) { st.token = tok; st.spent = false; verified(t, tok); },
        'expired-callback': function () { st.token = null; },
        'timeout-callback': function () { st.token = null; },
        'error-callback': function (code) {
          st.token = null;
          tsMessage(t, vci.config(F, 'error-text', 'The security check did not pass. Reload the page and try again.', t), true);
          vci.emit(f || t, 'form:error', { form: f, code: code });
        }
      };
      var action = vci.config(F, 'action', '', t);
      if (action) opts.action = action;
      var field = vci.config(F, 'response-field', '', t);
      if (field && !vci.bool(field, true)) opts['response-field'] = false;
      else if (field) opts['response-field-name'] = field;
      try { st.id = ts.render(t, opts); }
      catch (x) { vci.warn('form: Turnstile render failed', x); }
    });
  }

  function verified(t, tok) {
    var f = formOf(t);
    tsMessage(t, '', false);
    if (f) vci.emit(f, 'form:verified', { form: f, token: tok });
    if (!f || !waiting.has(f)) return;
    var sub = waiting.get(f);
    waiting['delete'](f);
    if (f.requestSubmit) f.requestSubmit(sub && sub.form === f ? sub : undefined);
    else {
      var btn = sub && sub.click ? sub : f.querySelector('[type="submit"]');
      if (btn) btn.click();
    }
  }

  function armTurnstile(t) {
    if (vci.config(F, 'render', 'visible', t) === 'load' || !('IntersectionObserver' in w)) {
      render(t);
      return;
    }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) render(e.target); });
    }).observe(t);
  }

  function tokenOf(f) {
    var t = turnstileOf(f);
    var st = t && widgets.get(t);
    return st && st.token && !st.spent ? st.token : null;
  }

  /* ---------- events ---------- */
  // A field left by pressing something (the submit button, most often) is
  // painted once the press is over. A message that appears on blur can push
  // the button out from under the pointer between mousedown and mouseup, and
  // the click is lost.
  var pressing = false, deferred = [];
  d.addEventListener('pointerdown', function () { pressing = true; }, true);
  function released() {
    if (!pressing) return;
    pressing = false;
    setTimeout(function () {
      var q = deferred; deferred = [];
      q.forEach(function (c) { paint(c); });
    }, 0);
  }
  d.addEventListener('pointerup', released, true);
  d.addEventListener('pointercancel', released, true);

  function controlEvent(e) {
    var c = e.target;
    if (!isControl(c) || !formOf(c)) return;
    prepare(c.form);
    if (e.type === 'focusout') {
      if (dirty.get(c)) touched.set(c, true);
      if (pressing) { if (deferred.indexOf(c) < 0) deferred.push(c); return; }
    } else dirty.set(c, true);
    paint(c);
    // A radio's siblings change state with it.
    if (c.type === 'radio' && c.form) {
      controls(c.form).forEach(function (o) { if (o !== c && o.name === c.name) paint(o); });
    }
  }
  d.addEventListener('input', controlEvent);
  d.addEventListener('change', controlEvent);
  d.addEventListener('focusout', controlEvent);
  d.addEventListener('focusin', function (e) {
    var f = formOf(e.target);
    if (f) prepare(f);
  });

  // Capture on the document: this runs before the form's own listeners, so a
  // stopped submit never reaches Webflow's handler (or anyone else's).
  d.addEventListener('submit', function (e) {
    var f = e.target;
    if (!f || f.tagName !== 'FORM' || !formOf(f)) return;
    prepare(f);
    var bad = controls(f).filter(function (c) { return !paint(c, true); });
    if (bad.length) {
      e.preventDefault();
      e.stopImmediatePropagation();
      try { bad[0].focus({ preventScroll: false }); } catch (x) { bad[0].focus(); }
      vci.emit(f, 'form:blocked', { form: f, reason: 'invalid', controls: bad });
      return;
    }
    var t = turnstileOf(f);
    if (t) {
      var st = widgets.get(t);
      if (!tokenOf(f)) {
        e.preventDefault();
        e.stopImmediatePropagation();
        waiting.set(f, e.submitter || null);
        if (st && st.spent && st.id != null && w.turnstile) {
          st.spent = false; st.token = null;
          w.turnstile.reset(st.id);
        } else if (!st) render(t);
        tsMessage(t, vci.config(F, 'wait-text', 'Verifying…', t), false);
        vci.emit(f, 'form:blocked', { form: f, reason: 'turnstile', controls: [] });
        return;
      }
      // Good for this submit only. Left in place (not reset now) so a handler
      // that reads the token after this event still finds it.
      st.spent = true;
      vci.emit(f, 'form:submit', { form: f, token: st.token });
      return;
    }
    vci.emit(f, 'form:submit', { form: f, token: null });
  }, true);

  d.addEventListener('reset', function (e) {
    var f = e.target;
    if (!f || f.tagName !== 'FORM' || !formOf(f)) return;
    setTimeout(function () { reset(f); }, 0);
  });

  function reset(f) {
    f = formOf(f);
    if (!f) return;
    controls(f).forEach(function (c) {
      dirty['delete'](c); touched['delete'](c); shown['delete'](c);
      paint(c);
    });
  }

  vci.ready(function () {
    vci.all(F, 'form').forEach(function (h) { prepare(formOf(h)); });
  });

  return {
    validate: function (el, show) {
      var f = formOf(el);
      if (!f) return true;
      prepare(f);
      var list = isControl(el) ? [el] : controls(f);
      return list.filter(function (c) { return !paint(c, show !== false); }).length === 0;
    },
    reset: reset,
    token: function (el) { var f = formOf(el); return f ? tokenOf(f) : null; },
    refresh: function (el) {
      var f = formOf(el), t = f && turnstileOf(f);
      var st = t && widgets.get(t);
      if (st) st.theme = null;
      if (t) render(t);
    }
  };
});
