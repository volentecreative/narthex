# Migrating christthekingchurch.com to narthex

The site runs the same four behaviours as inline site custom code and two
registered scripts. This maps each one onto narthex so the swap is a
find-and-replace in the Designer plus one script tag. Audited 2026-09-05
against the live Designer through the Webflow Data API.

Order of work: add the narthex script tag **alongside** the existing code,
migrate one behaviour at a time (both engines tolerate each other — they key
off different attributes), then delete the old code once every hook is moved.

## Status — attributes applied 2026-09-05 through the Webflow Data API

Every `vci-*` attribute below is on the elements in the Designer, unpublished.
They are inert until narthex loads, and the old code is all still in place, so
the site behaves exactly as it did — this is the "both engines side by side"
state the order of work above describes.

**What is left, in order:** merge and tag narthex `v0.2.0` → add the footer
script tag (§1) → remove `faq_accordion_toggle` from applied scripts and the
old blocks from custom code (§7). The mobile menu (§3) starts working the
moment the script tag lands.

Applied: `vci-nav` header/menu/toggle on the `navbar` component,
`vci-accordion` item/trigger/body/icon on the `faq-item` component,
`vci-modal` dialog/title/close/dim on the `modal` component.
Not applied, deliberately: anything on the orphaned Home modal (§4).

## What is different about this site

The North Church was built on Webflow's Navbar element. **Christ the King has
no `.w-nav` anywhere.** The header is a hand-built `<nav class="navbar">`, and
the hamburger is a plain `<div class="navbar_hamburger" data-mobile-toggle>`.

This is easy to misread, because the site *does* have `w--open` on it. Webflow
uses that class for two unrelated elements:

| Webflow element | Renders | What gets `w--open` | On this site |
| --- | --- | --- | --- |
| **Dropdown** | `.w-dropdown` / `.w-dropdown-toggle` / `.w-dropdown-list` | the toggle and the list | **three** — the nav dropdowns, incl. the mega menu |
| **Navbar** | `.w-nav` / `.w-nav-menu` / `.w-nav-button` | the menu button | **none** |

The three nav dropdowns are genuine `DropdownWrapper` elements and Webflow's own
JS opens them. narthex touches none of that — the nav module reads
`.w-nav-button`, the *Navbar* class, and there is no Navbar element here
(`NavbarWrapper`, `NavbarMenu` and `NavbarButton` all return zero matches).
That is the whole reason the mobile menu is dead while the dropdowns work.

Until now the nav module only knew how to watch a Webflow navbar, so on this
site `vci-nav="dim"` would have silently done nothing. narthex ≥ 0.2.0 adds the
`toggle` and `menu` roles for exactly this shape: narthex owns the open class
itself, and the hamburger gets the keyboard support a `<div>` does not have.

That gap is not theoretical here: **the mobile menu does not work on the live
site.** The open state is fully styled in the Designer and nothing toggles it —
see §3, which is the shortest section here and the one that fixes the most.

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

**The mobile menu is broken today, and this is why.** The Designer already has
a `.navbar_menu.is-open` combo class, fully styled at the `medium` breakpoint —
`max-height: calc(100vh - 6rem)`, `opacity: 1`, `pointer-events: auto`,
`transform: translate(0px, 0rem)`, `overscroll-behavior: contain`. The base
`.navbar_menu` at that breakpoint is its closed twin: `max-height: 0`,
absolutely positioned under the header. The open state was designed and built.
**Nothing ever toggles the class.** There is no handler for
`data-mobile-toggle` in the site's custom code, and neither applied registered
script is a menu toggle.

So this is not really a migration — it is the missing half of something already
built. narthex's default `vci-nav-menu-class` is `is-open`, the exact class the
Designer is waiting for, so `vci-nav="toggle"` and `vci-nav="menu"` connect the
two ends and the menu works. No new styles, no `vci-nav-menu-class` override.

It also brings what the design never had a place for: the page stops scrolling
behind the open menu (the lock is shared with the modal engine, so a modal
opened over the menu does not strand it), the hamburger becomes focusable and
announces itself as a button — it is a `<div>`, so today it cannot be reached
from the keyboard at all — `aria-expanded` tracks the state, Escape closes, and
following a link inside the menu closes it.

**If an Interaction turns up.** The audit could not see Webflow Interactions
through the Data API. If one is found later that also toggles the class, do not
leave both: either delete it, or set `vci-nav-own="false"` on `.navbar_menu` so
narthex only watches the class and drives the dim, lock, aria and events off
it. The second only works if the Interaction toggles a *class* — one that
animates inline styles has nothing to watch.

**If the header is ever rebuilt on Webflow's Navbar element** — the most
Webflow-native end state, and worth doing: Webflow would then run the mobile
menu itself, exactly as it already runs the dropdowns. The migration is to
delete `vci-nav="toggle"` and `vci-nav="menu"`, keep `vci-nav="header"`, and add
`vci-nav="dim"` — narthex goes back to watching `w--open` on `.w-nav-button`,
which is the path The North Church uses. Nothing else in this document changes.
Note the Data API cannot build it: the element builder can create a `Dropdown`
but has no Navbar type, so that is a by-hand Designer job.

## 4. Modal + drawer engine (site footer script → `modal`)

The footer IIFE is the same engine The North Church had, so the map is the
same — but see the two findings at the end of this section before doing any of
it.

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

**No key, and no binding.** The North Church needed `vci-modal-key` bound to
the Modal ID prop by hand. This site does not, for two reasons:

- narthex resolves a key it cannot find as an attribute by falling back to
  `document.getElementById(key)`, and reads a host's own key from `el.id`. The
  Modal ID prop already writes the DOM id, so `vci-modal="dialog"` on its own
  is enough — a trigger with `vci-modal-key="connect"` finds `#connect`.
- The binding is not possible anyway. The Modal ID prop is Webflow's `id` type,
  and `get_bindable_sources` reports it as bindable **only** to an `id` setting
  — not to an attribute value, in the API or by hand. (The North Church note
  should be revisited on this point.)

**Nothing on the site uses this engine yet.** All 22 pages were scanned: there
are **no `data-modal-open` triggers anywhere**, and the `modal` component has
**zero instances**. The only `.modal` in the site is one on Home, and it is
leftover scaffolding — the component's default "Modal title", a close link
still reading "Button Text", no DOM id, no `.modal-dim`, and nothing that opens
it. It was left untouched; it wants deleting, not migrating, but that is a call
for whoever put it there.

So §4 is really forward-looking: the roles are on the component so the next
modal someone builds works, and the ~200-line footer IIFE can be deleted
outright rather than migrated, because it has no users.

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
- **Site footer custom code**: the modal/drawer IIFE — which currently drives
  nothing at all (§4), so this one is a straight deletion. **Keep** the parallax
  injector and the Turnstile CSS.
- **Applied scripts**: `faq_accordion_toggle` (§5).
- **Dead `data-*` attributes in the Designer.** These are the old engines'
  hooks, not narthex's — narthex reads only `vci-*` — and they are kept until
  the code that reads them is gone, so nothing breaks mid-migration. Once §7 is
  done they refer to nothing:

  | Attribute | On | Read by |
  | --- | --- | --- |
  | `data-mobile-toggle` | `.navbar_hamburger` | nothing, today — it is the hook the missing menu toggle was meant to use (§3) |
  | `data-modal-close` | `a.modal_close` in the `modal` component, and the orphan on Home | the footer modal IIFE |

  Leave `data-theme-toggle` on the navbar's hidden theme link: it belongs to the
  commented-out theme switcher, which is not part of this migration.

  The state classes are a different matter and **do not** get renamed.
  `is-open` and `is-visible` are Designer classes that narthex is configured to
  match (`vci-nav-menu-class`, `vci-modal-class`), not names narthex imposes —
  the whole point of them being settings. `.navbar_menu.is-open` already
  existed and is why §3 needs no new styles.

## 8. Proving it before touching the Designer

`test/fixtures/migration-christtheking.html` is markup shaped like the live
site — hand-built navbar, div hamburger, the modal component, the div FAQ row —
with the attributes from this document on it. `npm run test:migration` asserts
the whole map against it: the `--nav-height` name is preserved, `--nav-offset`
tracks the scrolling announcement bar, the hamburger opens by click and by
Enter, the dim and lock follow, the modal keys and `?modal=` deep link work,
and the FAQ answer opens on the state attribute with no `.is-open` on the
answer or icon.
