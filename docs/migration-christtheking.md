# Migrating christthekingchurch.com to narthex

The site runs the same four behaviours as inline site custom code and two
registered scripts. This maps each one onto narthex so the swap is a
find-and-replace in the Designer plus one script tag. Audited 2026-09-05
against the live Designer through the Webflow Data API.

Order of work: add the narthex script tag **alongside** the existing code,
migrate one behaviour at a time (both engines tolerate each other — they key
off different attributes), then delete the old code once every hook is moved.

## What is different about this site

The North Church was built on Webflow's Navbar element. **Christ the King has
no `.w-nav` anywhere.** The header is a hand-built `<nav class="navbar">`, and
the hamburger is a plain `<div class="navbar_hamburger" data-mobile-toggle>`.

Until now the nav module only knew how to watch a Webflow navbar, so on this
site `vci-nav="dim"` would have silently done nothing. narthex ≥ 0.2.0 adds the
`toggle` and `menu` roles for exactly this shape: narthex owns the open class
itself, and the hamburger gets the keyboard support a `<div>` does not have.

One thing the audit could **not** establish: what opens the menu today. There is
no handler for `data-mobile-toggle` in the site's custom code, and neither
registered script's body is readable from here — so it is presumably a Webflow
Interaction on the hamburger. That matters for §3, which has a decision in it.

## 1. Load narthex

Site settings → Custom code → **Footer**, above the existing `<script>` blocks:

```html
<script src="https://cdn.jsdelivr.net/gh/volentecreative/narthex@v0.2.0/dist/narthex.min.js"
        vci-scroll="native"
        vci-scroll-offset="calc(var(--nav-height, 4.5rem) + 1.5rem)"></script>
```

The offset is the site's existing `scroll-padding-top` rule, verbatim, so
anchors land exactly where they land today.

## 2. Header measurement (site head script → `nav`)

| Today | narthex | Where |
| --- | --- | --- |
| `.navbar` measured into `--nav-height` on `:root` | `vci-nav="header"` **plus** `vci-nav-height-var="--nav-height"` | the `navbar` component root (`nav.navbar`) |
| `html { scroll-padding-top: calc(var(--nav-height, 4.5rem) + 1.5rem) }` | the `vci-scroll-offset` in §1 | — |

`vci-nav-height-var` is the whole trick here: **keep the variable name.** The
Designer already uses `--nav-height` in the `.sticky-menu` top offset and in the
`nav-height` site variable's 4.5rem fallback. Pointing narthex at the existing
name means not one style rule changes.

narthex also writes `--nav-offset` — the header's *current bottom edge*, updated
on scroll. The old script never had this. It is the more accurate value for
anything sticking below the header, because the `announcement-bar` sits above
the navbar in `page-wrapper` and scrolls away: at the top of the page the edge is
112px, once scrolled it is 72px. Worth switching `.sticky-menu` to it later;
not part of this migration.

## 3. Mobile menu (Webflow Interaction → `nav`)

| Today | narthex | Where |
| --- | --- | --- |
| `.navbar_menu` shown by an Interaction | `vci-nav="menu"` | `.navbar_menu` |
| `.navbar_hamburger[data-mobile-toggle]` | `vci-nav="toggle"` | `.navbar_hamburger` |
| — (there is no dim today) | `vci-nav="dim"` on a new full-page div, if you want one | sibling of the navbar |
| — | `vci-nav-key="main"` on the navbar root and the dim | pairs the three roles |

What this buys, none of which the site has today: the page stops scrolling
behind the open menu (the lock is shared with the modal engine, so a modal
opened over the menu does not strand it), the hamburger becomes focusable and
announces itself as a button, `aria-expanded` tracks the state, Escape closes,
and following a link inside the menu closes it.

**The decision.** Two engines must not both own the open class:

- **narthex owns it** — delete the Interaction, and style the open menu from
  `.navbar_menu.is-open` in the Designer. Simplest, and the option the fixture
  test covers.
- **The Interaction keeps it** — set `vci-nav-own="false"` on `.navbar_menu`.
  narthex then only watches the class and drives the dim, lock, aria and
  events off it. This only works if the Interaction toggles a *class*; a
  Webflow Interaction that animates inline styles instead has nothing to
  watch, in which case take the first option.

Check which the Interaction actually does before choosing. Use
`vci-nav-menu-class` if the class it toggles is not `is-open`.

## 4. Modal + drawer engine (site footer script → `modal`)

The footer IIFE is the same engine The North Church had, so the map is the same.

| Today | narthex | Where |
| --- | --- | --- |
| `.modal` shell resolved by `#<Modal ID>` | `vci-modal="dialog"` + `vci-modal-key` **bound to the Modal ID prop** | the `modal` component root |
| `data-modal-open="<key>"` | `vci-modal="open"` + `vci-modal-key="<key>"` | every trigger |
| `data-modal-close` | `vci-modal="close"` | `a.modal_close`, and the page-level shells |
| `.modal-dim` (click closes) | `vci-modal="dim"` | `.modal-dim` in the component |
| `.modal_header h2` | `vci-modal="title"` | optional, for triggers that set a title |
| `is-visible` open class | the default — no setting needed | — |
| `?modal=<key>` deep links | unchanged | — |
| `data-modal` / `data-drawer-*` (drawer half) | `vci-modal="drawer"` / `part` / `handle` / `scrim` | **nothing on this site uses them yet** |

The engine's drawer half — swipe-to-dismiss, `data-modal-desktop-inline` — has
no users in the current Designer. It maps cleanly if a drawer is ever added; it
is not migration work today.

**One binding the API cannot set.** `vci-modal-key` on the `modal` component
root has to be bound to the **Modal ID** prop, the same prop the `id` is bound
to, and attribute *bindings* can only be made by hand in the Designer. Same
caveat as The North Church. Page-level `.modal` shells that are not component
instances (the one on Home) take a plain static `vci-modal-key` instead.

## 5. FAQ accordion (registered script `faq_accordion_toggle` → `accordion`)

| Today | narthex |
| --- | --- |
| `.faq_item` | add `vci-accordion="item"` |
| `.faq_toggle` (a div with `role="button"`, `tabindex`, `aria-expanded`) | add `vci-accordion="trigger"` — narthex keeps the aria in sync, and the hand-written `role`/`tabindex` can stay or go |
| `.faq_answer` | add `vci-accordion="body"` |
| `.faq_icon` | add `vci-accordion="icon"` |
| `.faq_list` wrapper | `vci-accordion="group"`, plus `vci-accordion-single="true"` if only one row should be open |

**The one CSS change.** The old script put `.is-open` on the item, the answer
**and** the icon. narthex puts the open class on the **item only**, and drives
the answer and the icon from `vci-accordion-state="open"`, which it also
supplies the collapse CSS for. So in the Designer:

- `.faq_item.is-open` — unchanged, keep whatever it styles.
- any rule on `.faq_answer.is-open` → delete it; narthex's grid-rows collapse
  replaces it.
- any rule on `.faq_icon.is-open` (the chevron rotation) → delete it; narthex
  rotates the icon 180° itself.

Keying the collapse on the state attribute rather than a class is also what
makes a nested accordion behave — a class rule opens inner bodies along with
their parent.

Once the roles are on, **remove `faq_accordion_toggle` from the site's applied
scripts.** It and narthex would both toggle the item.

## 6. What stays, and what is not narthex's business

| Thing | Where | Note |
| --- | --- | --- |
| Sticky-menu jump links + scrollspy | site head custom code | Keep. narthex has no scrollspy, and the `is-current` active state is genuinely site-specific. Its `e.preventDefault()` on jump links can go once `vci-scroll="native"` is on — that is what turns Webflow's own handler off — but the scrollspy half stays. |
| `navbarSpeakerNames` | registered script, site footer | unchanged |
| `LivestreamResolver` | registered script | unchanged |
| `Theme Logo Swap CSS` | registered, not applied | unchanged |
| Parallax CSS injector (`.parallax-5/10/20`) | site footer custom code | unchanged — presentation, not state |
| Turnstile hiding CSS on `.media-filter-form` | site footer custom code | unchanged. **It is missing its closing `}`** — browsers recover at end of stylesheet so it works today, but fix it while you are in there. |
| Theme switcher | site head, commented out | left alone |

## 7. Delete list (only after every hook above is moved)

- **Site head custom code**: the nav-height measurer IIFE and the
  `scroll-padding-top` style. **Keep** the sticky-menu scrollspy (§6) — lift it
  into its own `<script>` when the measurer goes.
- **Site footer custom code**: the modal/drawer IIFE. **Keep** the parallax
  injector and the Turnstile CSS.
- **Applied scripts**: `faq_accordion_toggle` (§5).

## 8. Proving it before touching the Designer

`test/fixtures/migration-christtheking.html` is markup shaped like the live
site — hand-built navbar, div hamburger, the modal component, the div FAQ row —
with the attributes from this document on it. `npm run test:migration` asserts
the whole map against it: the `--nav-height` name is preserved, `--nav-offset`
tracks the scrolling announcement bar, the hamburger opens by click and by
Enter, the dim and lock follow, the modal keys and `?modal=` deep link work,
and the FAQ answer opens on the state attribute with no `.is-open` on the
answer or icon.
