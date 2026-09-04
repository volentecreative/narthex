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
        vci-scroll-offset="calc(var(--header-height) + var(--_spacing---gutter))"></script>
```

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
| `data-team-contact-toggle` / `data-team-contact-form` | unchanged — stays as a five-line site script in the footer (see §5) | leadership modal |
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

## 4. Header and scroll (site footer → `nav`, `scroll`)

| Today | narthex |
| --- | --- |
| `.navbar` measured into `--header-height` / `--nav-offset` | `vci-nav="header"` on the navbar root. Variable names are the defaults. |
| `html { scroll-behavior: smooth }`, `:target { scroll-margin-top: calc(var(--header-height) + var(--_spacing---gutter)) }`, `$(document).off('click.wf-scroll')` | `vci-scroll="native"` on the script tag; `vci-scroll-offset="calc(var(--header-height) + var(--_spacing---gutter))"` to keep the gutter |

## 5. What stays in this repo and in Webflow

Site-specific, and deliberately not in narthex:

| Thing | Where it lives | Note |
| --- | --- | --- |
| Livestream notice + `/live` player | `webflow/livestream-handler.html` (embed in the `footer` component) | unchanged |
| MP widget theme injector | `webflow/mp-theme-injector.js` (registered script `tnc_mp_theme_injector_v4`) | unchanged |
| Finsweet label → `fs-list-value` and `?series=` / `?ministry=` deep links | `/media` and `/events` page footer code | unchanged |
| `data-newtab`, `data-team-contact-toggle` | site footer custom code | keep as one small script once the modal engine is deleted — the toggle currently rides inside the modal IIFE's click handler |
| `[data-hide-if-empty]` CSS | Ministries template page code | unchanged |
| Search modal renderer | `webflow/search-modal-handler.html` | switch its open/close to `vci:modal:*` events (§2) |
| MP auth state / user fields / custom-form styles / account tabs | registered scripts | unchanged |

## 6. Delete list (only after every hook above is moved)

- Site footer custom code: the modal/drawer IIFE (after lifting its
  `data-team-contact-toggle` branch into a small standalone script), the
  navbar offset IIFE, the smooth-scroll style + `Webflow.push` block, the
  accordion style + script. **Keep** the `data-newtab` script and the
  `.page-nav-menu` mask CSS.
- Repo files: the script half of `webflow/rich-text-accordion.html` (its CSS
  stays, with the selectors from §3).

Everything in §5 is untouched by this migration.
