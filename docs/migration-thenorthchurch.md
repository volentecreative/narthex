# Migrating thenorthchurch.com to narthex

The site currently runs the same behaviours as inline custom code (site
footer), page-level code, registered scripts, and HTML embeds. This maps each
one onto narthex so the swap is a find-and-replace in the Designer plus one
script tag, not a rewrite. Audited 2026-09-04 against the live Designer.

Order of work: add the narthex script tag **alongside** the existing code,
migrate one behaviour at a time (both engines tolerate each other — they key
off different attributes), then delete the old code once every hook is moved.

## 1. Load narthex

Site settings → Custom code → **Footer**, above the existing `<script>` blocks:

```html
<script src="https://cdn.jsdelivr.net/gh/volentecreative/narthex@v0.1.0/dist/narthex.min.js"
        vci-scroll="native"
        vci-livestream-key="AIzaSyCuZVn83sTy4i_j3-3e9u8GfPiXn5FNPSc"
        vci-livestream-handle="thenorthchurch"
        vci-shadow-css="https://cdn.prod.website-files.com/695edb3de14cbcfe30f55baf/6a9a4f8daaffd3efb5dec931_mp-widget-theme-v4.css"
        vci-shadow-css-tags="mpp-user-login,mpp-household,mpp-my-groups,mpp-subscriptions,mpp-my-invoices,mpp-my-giving,mpp-my-mission-trips,mpp-online-directory,mpp-event-details,mpp-invoice-payment,mpp-custom-form,mpp-checkout,mpp-group-details,mpp-event-finder,mpp-opportunity-details,mpp-group-finder"></script>
```

The YouTube key is already public in the page source today (it lives in the
footer embed); it is referrer-restricted in Google Cloud, which is the real
control. Keep it that way.

## 2. Modal + drawer engine (site footer script → `modal`)

| Today | narthex | Where it lives |
| --- | --- | --- |
| `.modal` shell resolved by form id / `wf-form-<key>` / dialog id | `vci-modal="dialog"` + `vci-modal-key="<key>"` on the `.modal` element | components `modal-connect`, `modal-north-update`, `modal-search`; the team-member `.modal` on `/about/leadership` |
| `data-modal="<key>"` (drawer host) | `vci-modal="drawer"` + `vci-modal-key="<key>"` | component `drawer` (root `.drawer`) |
| `data-modal-desktop-inline` | `vci-modal-inline="(min-width: 992px)"` | same element |
| `data-modal-open="<key>"` | `vci-modal="open"` + `vci-modal-key="<key>"` | navbar links (`connect`, `north-update`, `global-search` ×2), CMS cards, drawer buttons |
| `data-modal-close` | `vci-modal="close"` | drawer close button, modal close wrappers |
| `.modal-dim` (click closes) | `vci-modal="dim"` on that element | every modal shell |
| `data-drawer-scrim` (+ `data-modal-close`) | `vci-modal="scrim"` — one attribute; scrim click closes | drawer `.modal-dim.is-drawer-dim` |
| `data-drawer-part` | `vci-modal="part"` | `.drawer_panel` |
| `data-drawer-handle` | `vci-modal="handle"` | `.drawer_header` |
| `data-team-member-field` | `vci-modal="field"` | hidden input in the leadership contact form |
| `data-member-name` / `h3` fallback | `vci-modal-value="<name>"` on the card trigger (CMS-bound), or `vci-modal="title"` on the `h3` | person-card trigger / modal heading |
| `data-team-contact-toggle` / `data-team-contact-form` | `vci-toggle="trigger"` / `vci-toggle="target"` inside a `vci-toggle="scope"` wrapper (the modal dialog) | leadership modal |
| `.navbar_menu-dim` click + `.navbar_menu-dim-open` | `vci-nav="dim"` + `vci-nav-dim-class="navbar_menu-dim-open"` | navbar component |

Keys stay what they are: `connect`, `north-update`, `global-search`, and the
drawer keys. The `?modal=<key>` URL contract is unchanged (dialogs write it,
drawers do not), so existing links keep working.

**Search modal handler** (`webflow/search-modal-handler.html`, embed inside
`modal-search`): it binds its own click handlers on `[data-modal-open="search"]`
and watches the `.modal` class. After the swap, delete its open/close/trap
code and replace with:

```js
document.addEventListener('vci:modal:open',  function (e) { if (e.detail.key === 'global-search') { loadAlgolia(); input.focus(); input.select(); } });
document.addEventListener('vci:modal:close', function (e) { if (e.detail.key === 'global-search') { /* nothing: narthex restores focus */ } });
```

## 3. Accordion (site footer script + `rich-text-accordion.html` → `accordion`)

| Today | narthex |
| --- | --- |
| `.accordion-item` | add `vci-accordion="item"` (keep the class for styling) |
| `.accordion-heading` (button or div with `aria-expanded`) | add `vci-accordion="trigger"` |
| `.accordion-body` | add `vci-accordion="body"` |
| `.accordion-heading .icon-regular` | add `vci-accordion="icon"` |
| `data-open="true"` | `vci-accordion-open="true"` |
| `.is-open` class | default — or `vci-accordion-class="is-open"` if it ever changes |
| `[data-rich-text-accordion]` on the Ministries template Opportunities field | `vci-accordion="richtext"` plus the class settings below |

Rich-text settings to reproduce today's markup exactly (put them on the
richtext element):

```
vci-accordion-section-tag="h4"
vci-accordion-item-tag="h5"
vci-accordion-title-class="acc-section-title"
vci-accordion-heading-class="acc-item-heading"
vci-accordion-stack-class="vert-flex"
vci-accordion-item-class="accordion-item"
vci-accordion-trigger-class="accordion-heading text-size-regular text-weight-bold text-color-inherit"
vci-accordion-icon-class="icon-regular text-color-inherit"
vci-accordion-body-class="accordion-body"
vci-accordion-inner-class="accordion-body-inner"
vci-accordion-text-class="accordion-body-text"
```

The presentation CSS in `rich-text-accordion.html` stays, with its selectors
changed from `[data-rich-text-accordion]` / `[data-acc-section]` /
`[data-acc-items]` to `[vci-accordion="richtext"]` / `[vci-accordion="section"]`
/ `[vci-accordion="group"]`. The footer's grid-rows collapse CSS and the icon
rotation rule can be deleted: narthex injects equivalents keyed on
`vci-accordion-state`, which also fixes nested accordions (the class-based
rule would have opened inner bodies with their parent).

## 4. Header, scroll, new-tab (site footer → `nav`, `scroll`, `utils`)

| Today | narthex |
| --- | --- |
| `.navbar` measured into `--header-height` / `--nav-offset` | `vci-nav="header"` on the navbar root. Variable names are the defaults. |
| `html { scroll-behavior: smooth }`, `:target { scroll-margin-top: calc(var(--header-height) + var(--_spacing---gutter)) }`, `$(document).off('click.wf-scroll')` | `vci-scroll="native"` on the script tag; `vci-scroll-offset="calc(var(--header-height) + var(--_spacing---gutter))"` to keep the gutter |
| `[data-newtab]` | `vci-newtab` |
| `[data-hide-if-empty]` + `:has(.w-dyn-empty)` (Ministries template) | `vci-empty="hide"`. The second rule (hide `a[href="#events"]` when `#events` is empty) stays as page CSS — it is a one-off. |

## 5. Finsweet helpers (`/media`, `/events` page code → `fslist`)

| Today | narthex |
| --- | --- |
| script copying `label.sermons_check` / `label.filter_check` text into `fs-list-value` | `vci-fslist="label-value"` on the filter form (or each checkbox group) |
| `?series=<Name>` on `/media` | `vci-fslist="deeplink" vci-fslist-param="series"` on the series checkbox group |
| `?ministry=<Name>` on `/events` | `vci-fslist="deeplink" vci-fslist-param="ministry" vci-fslist-field="ministry"` on the ministry group |

Keep Finsweet's own `<script type="module" … fs-list>` tag on those pages.

## 6. Livestream (`livestream-handler.html` embed in `footer` → `livestream`)

| Today | narthex |
| --- | --- |
| `[sunday-livestream-link]` | `vci-livestream="link"` |
| `[sunday-livestream-embed]` (home hero) | `vci-livestream="embed"` |
| `[sunday-livestream-embed="fallback"]` (`/live`) | `vci-livestream="player"` |
| key / handle constants in the script | `vci-livestream-key` / `vci-livestream-handle` on the script tag |
| Sunday-only in America/Chicago, `?livestream=test` | defaults — `vci-livestream-days="sun"`, `vci-livestream-tz="America/Chicago"`, `vci-livestream-test="livestream=test"` |

The `.livestream-notice:hover .livestream-color-overlay` rule stays in the
embed (or moves to site head CSS).

## 7. Shadow-root theme (`mp-theme-injector.js`, registered script `tnc_mp_theme_injector_v4` → `shadow-css`)

Replaced entirely by the two `vci-shadow-css*` attributes on the script tag in
step 1. Remove the registered script from the site footer once verified on
`/event-details` and `/account`. When the stylesheet is re-uploaded (its URL
changes every edit), update the attribute — one place instead of a script
re-registration.

## 8. Delete list (only after every hook above is moved)

- Site footer custom code: the modal/drawer IIFE, the navbar offset IIFE, the
  smooth-scroll style + `Webflow.push` block, the `data-newtab` script, the
  accordion style + script. **Keep** the `.page-nav-menu` mask CSS.
- `footer` component: the livestream embed's `<script>` (keep its `<style>`).
- `/media` and `/events` page footer code: the two inline scripts (keep
  Finsweet's tag).
- Registered script `tnc_mp_theme_injector_v4` (and the v1–v3 leftovers).
- Repo files: `webflow/livestream-handler.html`, `webflow/mp-theme-injector.js`,
  the script half of `webflow/rich-text-accordion.html`.

Untouched by this migration: `tnc_search_config`, the MP auth/user-field
scripts, `tnc_mp_custom_form_styles_v7`, `tnc_mp_widget_shadow_styles_v3`,
the account page tab script, the `/media` filter-reset registered script, and
the page-nav-menu solver on `/account`.
