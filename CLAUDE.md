# CLAUDE.md

## What this repo is

**narthex** — Volente Creative's attribute-driven JavaScript utilities for
Webflow sites, served from jsDelivr (`cdn.jsdelivr.net/gh/volentecreative/narthex@<tag>/dist/…`).
Think Finsweet Attributes, prefix `vci-`. The README is the reference for the
convention and the release process; each module's header comment is the
reference for its roles, settings, events and API.

## Layout

| Path | What it is |
| --- | --- |
| `src/core.js` | The `window.vci` namespace: attribute helpers, settings resolution, `ready`, `emit`, CSS injection, the shared scroll lock, `define()`. Installs once per page. |
| `src/modules/*.js` | One module each. `vci.define('<name>', function (vci) { … })`. Independent of each other; share only core. |
| `scripts/build.js` | Concatenates core + module → `dist/<module>.js`; core + all → `dist/narthex.js`. No transpile, no minify (jsDelivr minifies on `.min.js`). |
| `dist/` | **Committed.** jsDelivr serves the repo as-is at a tag. Rebuild before every commit that touches `src/`. |
| `demo/index.html` | Every role exercised, with just enough CSS to see it. |
| `test/smoke.mjs` | Headless Chromium test of every module against the demo. `test/check.mjs` syntax-checks dist. |
| `docs/migration-*.md` | Per-site maps from old hooks to `vci-*`. |

## Rules

- **Attributes only.** No class-name hooks, no ids, no site-specific selectors
  in a module. If a behaviour needs a site's class name, it is a setting with a
  sensible default (`vci-modal-class="is-visible"`).
- **Two attribute shapes**, nothing else: `vci-<module>="<role>"` and
  `vci-<module>-<setting>="<value>"`. Settings resolve element → ancestors →
  `vci.settings` → `<script>` tag → default, via `vci.config()`.
- **State, not style.** Modules set classes, `aria-*`, `inert`, CSS variables,
  and only the CSS a state needs to work. Never colours, sizes, layout.
- ES5-compatible browser JS in modules (no build transpiles it). ESM only in
  `scripts/` and `test/`.
- Every module: header comment listing roles/settings/events/API; an API on
  `vci.<module>`; `vci:<module>:<event>` DOM events for site code to listen to.
- A change to an attribute name or default is a **breaking change** — major
  bump, migration note.
- `npm test` before pushing. It needs Playwright; in a sandbox without npm
  network, symlink a global install: `ln -s "$(npm root -g)/playwright" node_modules/playwright`.

## Release

`npm version <minor|patch>` → `npm run build` → commit → `git tag vX.Y.Z` →
push with tags. Sites pin `@vX.Y.Z` or float on `@vX`.
