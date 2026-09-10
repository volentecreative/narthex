# Migrating thenorthchurch.com to narthex

The site currently runs the same behaviours as inline custom code (site
footer), page-level code, registered scripts, and HTML embeds. This maps each
one onto narthex so the swap is a find-and-replace in the Designer plus one
script tag, not a rewrite. Audited 2026-09-04 against the live Designer.

Order of work: add the narthex script tag **alongside** the existing code,
migrate one behaviour at a time (both engines tolerate each other — they key
off different attributes), then delete the old code once every hook is moved.

## Status — applied 2026-09-04 through the Webflow Data API

Everything below is in the Designer (unpublished) except the attribute
**bindings**, which the API rejects and which have to be set by hand before
the site is published. The API refuses them two different ways, both worth
knowing: a CMS `value_binding` on an attribute comes back *"value must be a
string or a binding"*, and `set_dom_id` with the same binding comes back
*"Element is not inside a CMS context"* — because addressing an element
through `scope_component_id` loses the Collection List wrapped around it,
even when that Collection List is inside the same component.

1. **`button` component** → root Link: add attribute `vci-modal-key` bound to
   the **Open Modal** prop (the same prop `data-modal-open` is bound to).
   Without it a button whose Open Modal is set does nothing.
2. **`/about/leadership`** → each of the five `people-grid_item` Collection
   Items: add attribute `vci-modal-key` bound to the Team Member **Slug**
   (the same field `data-modal-open` is bound to). **Done** — verified
   2026-09-10, bound to Slug
   (`8588d8c71a7e8885ddea186382f436eb`).
3. **`modal-staff` component** → the `.modal` host inside the Collection Item:
   add `vci-modal-key` bound to the Team Member **Slug**, or set the element's
   **ID** to that same field. This is the half that is still missing, and it
   is the whole ball game: audited 2026-09-10, the host carries `vci-modal`
   and nothing else — no key attribute (bound or static) and no DOM id — so
   `resolve()` finds no host, `show()` returns false, and clicking a person
   card does nothing at all.

An earlier revision of this file claimed the member modal "already resolves
by its slug-bound id". It does not, and never did. Two things make that easy
to believe and hard to check: the element tree omits *bound* attributes
entirely (the trigger's own `vci-modal-key` is invisible there and only shows
up under `get_attributes`, as a `null` value), and this host is inside a
component definition, where bindings are hidden the same way. Use
`get_attributes` on the host — a bound key lists its name with a `null`
value, so a genuinely absent key is the one that lists nothing.

Then merge + tag narthex `v0.1.1` (the footer points at it) and publish.
The search modal was left with its own handler (`data-modal-open="search"` on
the navbar buttons) — see §2.

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
| `.modal` shell resolved by form id / `wf-form-<key>` / dialog id | `vci-modal="dialog"` + `vci-modal-key="<key>"` on the `.modal` element | components `modal-connect`, `modal-north-update`, `modal-search`. The team-member `.modal` (component `modal-staff`) is a **drawer**, not a dialog — see below |
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
`modal-search`) keeps owning its modal for now: it already binds
`[data-modal-open="search"]`, so the two navbar search buttons were changed
from `data-modal-open="global-search"` (which only the deleted engine
resolved) to `data-modal-open="search"`, and nothing else touched it. A later
pass can hand open/close to narthex (`vci-modal="dialog"` on the `.modal`
shell, `vci-modal="open"` on the buttons) and have the handler listen:

```js
document.addEventListener('vci:modal:open',  function (e) { if (e.detail.key === 'global-search') { loadAlgolia(); input.focus(); input.select(); } });
```

narthex ≥ 0.1.1 watches the open class, so the handler's own `closeModal()`
would not strand the scroll lock.

### The team-member modal is a drawer everywhere (2026-09-10)

"Modal on desktop, drawer on mobile" has no attribute for it: `vci-modal` is a
single role, not a responsive one, and `vci-modal-inline` does the opposite job
(it makes a host behave as ordinary page content while its query matches). So
`modal-staff` is `vci-modal="drawer"` at every width and *looks* like a centred
dialog on desktop, which costs nothing because the two roles only differ in
three ways and each one lands the right side up:

- **swipe-to-dismiss** is already gated on `swipe-media`, default
  `(max-width: 991px)` — off on desktop without asking;
- **`aria-expanded` on the triggers** is a straight gain on the person cards;
- **the `?modal=` URL param**, which drawers drop, is restored with
  `vci-modal-url="true"` on the host so a link to one person's bio keeps
  working.

The roles, on `modal-staff`: `drawer` on the `.modal` host, `part` on
`.modal-dialog.is-team` (first part = the panel that swipes), `scrim` on
`.modal-dim` (was `dim`, so the backdrop now fades as the panel is dragged),
and a new `.drawer_grab` > `.drawer_grab-bar` prepended to the panel carrying
`vci-modal="handle"`. **Swipe needs that handle** — `pointerdown` bails unless
the press starts inside one — so a drawer without it is only a bottom sheet.
Reusing the existing `drawer_grab*` classes means it is `display: none` at base
and only appears at `medium`, no new CSS.

Presentation is Designer-side and lives entirely at the `medium` breakpoint
(≤991px), matching both `swipe-media` and the existing `.drawer`; desktop is
untouched. On `.modal-dialog.is-team`: `margin-top: auto` bottom-anchors the
panel inside `.padding_global` (that wrapper is `flex-direction: column` and
centres its child, so bottom-aligning belongs here, not on `.modal` — which is
shared by every modal on the site and must not be restyled). Full bleed is
`align-self: stretch` + `width: auto` + negative side margins from the site's
own `--_spacing---negative-gutter` token: the negative-margin trick needs a
*stretched* item, and `.modal-dialog`'s base `width: 100%` would defeat it.
Then `max-width: none`, `max-height: 85vh`, `overflow-y: auto` with
`overscroll-behavior: contain`, `padding-top: 0` (the grab strip and the
panel's own 1rem gap supply the top spacing) and 1.25rem top corner radii.

Two things deliberately not done. There is **no slide-up transition**: `.modal`
toggles `display: none` → `flex`, and a transform cannot animate off that in
the same frame, so a CSS transition would be dead code. Giving it one means
converting `.modal` to opacity/visibility the way `.drawer` already is — a
change to every modal on the site, not this one. Swipe is unaffected either
way; narthex drives the drag with inline styles. And `.is-modal-flush`
(a `padding_global` helper that already zeroes the side padding at `medium`)
was **not** used, despite being exactly right, because `set_style` cannot
resolve site classes for an element addressed through `scope_component_id`
— it answers "One or more styles not found" for classes that plainly exist.
Hence the negative-margin route, which needs no new class on the wrapper.

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
