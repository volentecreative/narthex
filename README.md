# narthex

Attribute-driven JavaScript utilities for Webflow sites, served from jsDelivr.
One script, one attribute vocabulary, no per-site reinvention.

The idea is [Finsweet Attributes](https://finsweet.com/attributes) but for the
things we keep rebuilding on every build: modals and bottom-sheet drawers,
accordions (including rich-text-to-accordion), header offsets, native smooth
scroll, new-tab links, class toggles, Finsweet list helpers, a YouTube
livestream notice, and CSS injection into web-component shadow roots.

```html
<!-- everything -->
<script src="https://cdn.jsdelivr.net/gh/volentecreative/narthex@v0.1.0/dist/narthex.min.js"></script>

<!-- or only what the site uses -->
<script src="https://cdn.jsdelivr.net/gh/volentecreative/narthex@v0.1.0/dist/modal.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/volentecreative/narthex@v0.1.0/dist/accordion.min.js"></script>
```

Put it in **Site settings → Custom code → Footer** as a plain script (no
`async`/`defer` — the `fslist` helper has to beat Finsweet's deferred module,
and everything else waits for `DOMContentLoaded` on its own). Loading two
module files on one page is fine: the core installs once and each module
registers once.

> **jsDelivr only serves public repositories.** This repo has to be public for
> the URLs above to resolve. Nothing in it is secret — site-specific keys stay
> in the site's own attributes, never in this code.

## The attribute convention

Prefix is `vci-`. Two shapes, and only two:

| Shape | Meaning | Example |
| --- | --- | --- |
| `vci-<module>="<role>"` | what this element **is** to that module | `vci-modal="open"` |
| `vci-<module>-<setting>="<value>"` | how that module **behaves** | `vci-modal-key="connect"` |

Settings resolve in this order, first hit wins:

1. the attribute on the element itself
2. the same attribute on any **ancestor** — so a setting can sit on a wrapper,
   or on `<html>` to apply site-wide
3. `window.vci.settings.<module>.<setting>`, set before the script loads
4. the same attribute on the `<script>` tag that loaded narthex
5. the module's default

Keys pair elements: a trigger with `vci-modal-key="connect"` opens the host
with `vci-modal-key="connect"`. Roles are exclusive (one `vci-modal` value per
element); settings stack freely.

Why not `data-*`? Attribute values cannot be bound to component props inside a
Webflow component definition, but *any* attribute name works on the instance
side, and a distinct prefix makes "what does the site's JS hook into" a single
Designer search. Finsweet chose `fs-` for the same reason. To rebrand for
another agency set `window.vci = { prefix: 'acme' }` before the script loads
and every attribute becomes `acme-…`.

## Modules

Each module documents its full attribute surface in the header comment of its
source file — that comment is the reference, kept next to the code so it
cannot drift.

| Module | File | What it does |
| --- | --- | --- |
| **modal** | [`src/modules/modal.js`](src/modules/modal.js) | Modals and bottom-sheet drawers. Roles `dialog` / `drawer` / `open` / `close` / `part` / `handle` / `scrim` / `dim` / `field` / `title`. Focus trap, Escape, scroll lock, `?modal=<key>` deep links, swipe-to-dismiss, a media query that makes a drawer inline content on desktop. |
| **accordion** | [`src/modules/accordion.js`](src/modules/accordion.js) | Roles `item` / `trigger` / `body` / `icon` / `group`. Owns the collapse mechanics (grid-rows animation, `aria-expanded`, `inert`) and leaves the look to your classes. `vci-accordion="richtext"` converts a rich-text field: H1 → section, H2–H6 → row, `<hr>` closes a row. |
| **nav** | [`src/modules/nav.js`](src/modules/nav.js) | `header` writes `--header-height` and `--nav-offset` to `<html>`. `dim` follows Webflow's navbar open state (the only signal is the `w--open` class on `.w-nav-button`), closes the menu on click, and shares the scroll lock with modal. |
| **scroll** | [`src/modules/scroll.js`](src/modules/scroll.js) | `<script … vci-scroll="native">` turns off Webflow's jQuery anchor scroll and uses `scroll-behavior: smooth` + `:target { scroll-margin-top }`, which respects the header offset and reduced-motion. |
| **utils** | [`src/modules/utils.js`](src/modules/utils.js) | `vci-newtab` (`="external"` for other hosts only), `vci-toggle="trigger|target|scope"` class toggling with `aria-expanded`, `vci-empty="hide"` for a section whose Collection List rendered empty. |
| **fslist** | [`src/modules/fslist.js`](src/modules/fslist.js) | For Finsweet list filters: `label-value` copies checkbox label text into `fs-list-value` (Webflow can't CMS-bind attribute values); `deeplink` ticks the option named by `?<param>=` once Finsweet is ready. |
| **livestream** | [`src/modules/livestream.js`](src/modules/livestream.js) | Reveals a `link` and fills `embed`/`player` iframes when a YouTube channel is live. Quota-aware: channel id cached forever, live check cached per session and only on configured days. Key + handle are attributes on the script tag. |
| **shadow-css** | [`src/modules/shadow-css.js`](src/modules/shadow-css.js) | Appends a stylesheet `<link>` inside web components' open shadow roots — the only way to style MinistryPlatform's `<mpp-*>` widgets. Per element or per tag list. |

Every module exposes an API on `window.vci.<module>` and fires
`vci:<module>:<event>` DOM events (bubbling, with `detail`), so site-specific
code can listen instead of watching class mutations.

### Quick examples

```html
<!-- modal -->
<a href="#" vci-modal="open" vci-modal-key="connect">Connect</a>
<div class="modal" vci-modal="dialog" vci-modal-key="connect">
  <div class="modal-dim" vci-modal="dim"></div>
  <div class="modal-dialog">
    <h3 vci-modal="title">Connect</h3>
    <button vci-modal="close">×</button>
  </div>
</div>

<!-- drawer that becomes a sidebar at ≥992px -->
<div class="drawer" vci-modal="drawer" vci-modal-key="filters" vci-modal-inline="(min-width: 992px)">
  <div class="drawer-scrim" vci-modal="scrim"></div>
  <div class="drawer-panel" vci-modal="part">
    <div class="drawer-header" vci-modal="handle">…</div>
  </div>
</div>

<!-- accordion -->
<div vci-accordion="group" vci-accordion-single="true">
  <div class="faq-item" vci-accordion="item" vci-accordion-open="true">
    <h3><button vci-accordion="trigger">Question <span vci-accordion="icon">⌄</span></button></h3>
    <div vci-accordion="body"><div>Answer</div></div>
  </div>
</div>

<!-- rich text field on a CMS template -->
<div class="w-richtext" vci-accordion="richtext"
     vci-accordion-item-class="accordion-item"
     vci-accordion-trigger-class="accordion-heading text-size-regular text-weight-bold"></div>

<!-- header + livestream config on the script tag -->
<header class="navbar w-nav" vci-nav="header">…</header>
<script src="…/narthex.min.js" vci-scroll="native"
        vci-livestream-key="AIza…" vci-livestream-handle="thenorthchurch"></script>
```

The demo page [`demo/index.html`](demo/index.html) has a working instance of
every role with just enough CSS to see it move.

### What narthex owns and what it leaves to you

narthex changes **state**: classes, `aria-*`, `inert`, a few CSS variables, and
the small amount of CSS that state needs to mean anything (the accordion's
grid-rows collapse; the scroll module's `:target` margin). It never sets
colours, sizes, or layout — those are Webflow classes on your elements, and the
open-state class name (`is-visible`, `is-open`) is a setting, so it fits
whatever the site already uses.

## Versioning and releases

jsDelivr resolves GitHub tags, so a release is a tag:

```bash
npm version minor        # bumps package.json, builds nothing yet
npm run build            # dist/ is committed — jsDelivr serves the repo as-is
git add -A && git commit -m "v0.2.0" && git tag v0.2.0 && git push --tags
```

URL forms, from safest to most convenient:

| URL | Behaviour |
| --- | --- |
| `…/narthex@v0.2.0/dist/narthex.min.js` | pinned; never changes |
| `…/narthex@v0.2/dist/narthex.min.js` | latest patch of 0.2 |
| `…/narthex@v0/dist/narthex.min.js` | latest 0.x — takes new modules and fixes, not breaking changes |
| `…/narthex@main/dist/narthex.min.js` | bleeding edge, cached up to 12 h — not for production |

Append `.min.js` to any path and jsDelivr minifies it on request; the committed
`dist/` stays readable for debugging in DevTools. Breaking attribute changes
bump the major and get a migration note in the changelog.

## Development

```bash
npm run build     # src/core.js + src/modules/*.js → dist/*.js and dist/narthex.js
npm run check     # syntax-check every dist file
npm test          # build + check + headless smoke test of every module (needs playwright)
npm run serve     # http-server for the demo page
```

The smoke test (`test/smoke.mjs`) opens `demo/index.html` in headless Chromium
and exercises every role: open/close/focus/URL/lock for modals, swipe and
inline media query for drawers, single-mode and rich-text building for
accordions, and so on. `npm i -D playwright && npx playwright install chromium`
once, or symlink a global install into `node_modules/`.

Conventions: plain ES5-compatible browser JavaScript inside each module (the
build only concatenates — nothing is transpiled), JSDoc-style header comment
listing every role, setting, event and API, no dependencies. Modules register
with `vci.define('<name>', function (vci) { … return api; })` and do their own
`vci.ready()`.

## Not in narthex (yet)

Things that were reviewed for the first release and deliberately left where
they are, with the reason:

- **The North Church search modal** (Algolia renderer) — coupled to that index's
  record shapes and card templates. It can adopt `vci-modal` for open/close and
  listen for `vci:modal:open` to lazy-load Algolia, but the renderer itself is
  site code.
- **Page-nav-menu tab padding solver** — a bespoke layout algorithm for one
  component; would need its own design pass to generalise.
- **MinistryPlatform auth state / account tabs / custom-form styles** — the
  registered scripts are hosted on Webflow's CDN, which the session that
  wrote this could not reach. They are MP-specific and would form a separate
  `mp` namespace here once their sources are in a repo.

## Migrating an existing site

[`docs/migration-thenorthchurch.md`](docs/migration-thenorthchurch.md) maps
every `data-*` attribute and class hook the first site used onto its `vci-*`
equivalent, page by page, and lists what to delete from Webflow custom code
once the swap is done. It is the template for the next site's migration too.
