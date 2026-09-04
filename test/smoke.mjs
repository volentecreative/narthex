// Headless smoke test of every module against demo/index.html.
// Needs playwright + Chromium: `npm i -D playwright` (browsers via `npx playwright install chromium`),
// or point NODE_PATH at a global install.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = 'file://' + join(root, 'demo/index.html');
let failures = 0;
const ok = (cond, msg) => { if (cond) console.log('  ✓', msg); else { failures++; console.log('  ✗', msg); } };

const launch = { headless: true };
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(launch);

async function open(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 800 }, ...opts });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(url + (opts.query || ''));
  return { page, ctx, errors };
}

console.log('modal');
{
  const { page, ctx, errors } = await open();
  await page.click('[vci-modal="open"][vci-modal-key="connect"]');
  ok(await page.$eval('[vci-modal="dialog"][vci-modal-key="connect"]', (e) => e.classList.contains('is-visible')), 'opens with class');
  ok(await page.$eval('[vci-modal="dialog"][vci-modal-key="connect"]', (e) => e.getAttribute('aria-modal') === 'true' && e.getAttribute('role') === 'dialog'), 'aria-modal + role');
  ok(await page.$eval('[vci-modal="field"]', (e) => e.value === 'Josh'), 'field filled from trigger value');
  ok(await page.evaluate(() => new URL(location.href).searchParams.get('modal') === 'connect'), '?modal= written');
  ok(await page.evaluate(() => document.body.style.overflow === 'hidden'), 'scroll locked');
  ok(await page.$eval('[vci-modal="open"][vci-modal-key="connect"]', (e) => e.getAttribute('aria-expanded') === 'true'), 'trigger aria-expanded');
  ok(await page.evaluate(() => document.activeElement === document.querySelector('[vci-modal="dialog"][vci-modal-key="connect"] [vci-modal="close"]')), 'focus moves to close');
  await page.keyboard.press('Escape');
  ok(await page.$eval('[vci-modal="dialog"][vci-modal-key="connect"]', (e) => !e.classList.contains('is-visible')), 'Escape closes');
  ok(await page.evaluate(() => !new URL(location.href).searchParams.has('modal')), '?modal= cleared');
  ok(await page.evaluate(() => document.body.style.overflow === ''), 'scroll unlocked');
  ok(await page.evaluate(() => document.activeElement === document.querySelector('[vci-modal="open"][vci-modal-key="connect"]')), 'focus restored to trigger');
  await page.click('[vci-modal="open"][vci-modal-key="connect"]');
  await page.click('[vci-modal="dialog"][vci-modal-key="connect"] [vci-modal="dim"]', { position: { x: 4, y: 4 } });
  ok(await page.$eval('[vci-modal="dialog"][vci-modal-key="connect"]', (e) => !e.classList.contains('is-visible')), 'dim click closes');
  await page.click('[vci-modal="open"][vci-modal-key="global-search"]');
  ok(await page.$eval('[vci-modal="dialog"][vci-modal-key="global-search"]', (e) => e.classList.contains('is-visible')), 'second modal opens');
  await page.evaluate(() => vci.modal.open('connect'));
  ok(await page.$eval('[vci-modal="dialog"][vci-modal-key="global-search"]', (e) => !e.classList.contains('is-visible')), 'opening one closes the other');
  ok(await page.evaluate(() => vci.modal.isOpen('connect')), 'API isOpen');
  await page.evaluate(() => vci.modal.closeAll());
  ok(await page.evaluate(() => !vci.modal.openHosts().length), 'API closeAll');
  // events
  const seen = await page.evaluate(() => new Promise((res) => {
    const got = [];
    document.addEventListener('vci:modal:open', (e) => got.push('open:' + e.detail.key));
    document.addEventListener('vci:modal:close', (e) => got.push('close:' + e.detail.key));
    vci.modal.open('connect'); vci.modal.close('connect');
    res(got.join(','));
  }));
  ok(seen === 'open:connect,close:connect', 'events fire: ' + seen);
  // a foreign script removes the class: lock, aria and events must follow
  await page.evaluate(() => vci.modal.open('connect'));
  const ext = await page.evaluate(() => new Promise((res) => {
    document.addEventListener('vci:modal:close', (e) => res(e.detail.key), { once: true });
    document.querySelector('[vci-modal="dialog"][vci-modal-key="connect"]').classList.remove('is-visible');
  }));
  ok(ext === 'connect', 'class removed externally -> vci:modal:close fires');
  ok(await page.evaluate(() => document.body.style.overflow === '' && !vci.lock.active()), 'external close releases the scroll lock');
  ok(await page.evaluate(() => !new URL(location.href).searchParams.has('modal')), 'external close clears ?modal=');
  await page.evaluate(() => document.querySelector('[vci-modal="dialog"][vci-modal-key="connect"]').classList.add('is-visible'));
  await page.waitForTimeout(20);
  ok(await page.evaluate(() => vci.lock.active() && document.querySelector('[vci-modal="dialog"][vci-modal-key="connect"]').getAttribute('aria-modal') === 'true'), 'class added externally -> lock + aria applied');
  await page.evaluate(() => vci.modal.closeAll());
  ok(errors.length === 0, 'no console errors: ' + errors.join(' | '));
  await ctx.close();
}
{
  const { page, ctx } = await open({ query: '?modal=connect' });
  ok(await page.$eval('[vci-modal="dialog"][vci-modal-key="connect"]', (e) => e.classList.contains('is-visible')), 'opens from ?modal= on load');
  await ctx.close();
}

console.log('drawer');
{
  const { page, ctx } = await open();
  await page.click('[vci-modal="open"][vci-modal-key="filters"]');
  ok(await page.$eval('.drawer', (e) => e.classList.contains('is-visible')), 'drawer opens');
  ok(await page.$eval('.drawer-panel', (e) => e.classList.contains('is-visible')), 'part gets class');
  ok(await page.evaluate(() => !new URL(location.href).searchParams.has('modal')), 'drawer skips URL param');
  ok(await page.$eval('[vci-modal="open"][vci-modal-key="filters"]', (e) => e.getAttribute('aria-expanded') === 'true'), 'trigger aria-expanded');
  // swipe down to dismiss
  const h = await page.$('[vci-modal="handle"]');
  const box = await h.boundingBox();
  await page.mouse.move(box.x + 50, box.y + 10);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + 50, box.y + 10 + i * 40);
  await page.mouse.up();
  await page.waitForTimeout(600);
  ok(await page.$eval('.drawer', (e) => !e.classList.contains('is-visible')), 'swipe down dismisses');
  ok(await page.$eval('.drawer-panel', (e) => e.style.transform === ''), 'inline transform cleaned up');
  await page.click('[vci-modal="open"][vci-modal-key="filters"]');
  await page.click('[vci-modal="scrim"]', { position: { x: 4, y: 4 } });
  ok(await page.$eval('.drawer', (e) => !e.classList.contains('is-visible')), 'scrim click closes drawer');
  await ctx.close();
}
{
  const { page, ctx } = await open({ viewport: { width: 1200, height: 800 } });
  await page.click('[vci-modal="open"][vci-modal-key="filters"]');
  ok(await page.$eval('.drawer', (e) => !e.classList.contains('is-visible')), 'inline media query blocks opening on desktop');
  await ctx.close();
}

console.log('accordion');
{
  const { page, ctx } = await open();
  const items = '#faq [vci-accordion="item"]';
  ok(await page.$$eval(items, (l) => l[0].classList.contains('is-open') && l[0].getAttribute('vci-accordion-state') === 'open'), 'vci-accordion-open starts open');
  ok(await page.$$eval(items, (l) => l[1].querySelector('[vci-accordion="body"]').getAttribute('aria-hidden') === 'true' && l[1].querySelector('[vci-accordion="body"]').inert === true), 'closed body is aria-hidden + inert');
  await page.click(items + ':nth-child(2) [vci-accordion="trigger"]');
  ok(await page.$$eval(items, (l) => l[1].classList.contains('is-open') && !l[0].classList.contains('is-open')), 'single mode: opening second closes first');
  ok(await page.$$eval(items, (l) => l[1].querySelector('[vci-accordion="trigger"]').getAttribute('aria-expanded') === 'true'), 'trigger aria-expanded');
  await page.waitForTimeout(400);
  ok(await page.$$eval(items, (l) => getComputedStyle(l[1].querySelector('[vci-accordion="body"]')).gridTemplateRows !== '0px'), 'open body expands via built-in CSS');
  await page.click(items + ':nth-child(2) [vci-accordion="trigger"]');
  ok(await page.$$eval(items, (l) => !l[1].classList.contains('is-open')), 'trigger click closes');
  await page.click(items + ':nth-child(2) .acc-text', { force: true }).catch(() => {});
  // rich text
  const rt = await page.$eval('#rt', (e) => ({
    ready: e.getAttribute('vci-accordion-ready'),
    sections: e.querySelectorAll('[vci-accordion="section"]').length,
    items: e.querySelectorAll('[vci-accordion="item"]').length,
    order: Array.from(e.children[0].children).map((c) => c.tagName + (c.getAttribute('vci-accordion') ? '.' + c.getAttribute('vci-accordion') : '')).join(' '),
    kids: Array.from(e.children[1].children).map((c) => c.tagName + (c.getAttribute('vci-accordion') ? '.' + c.getAttribute('vci-accordion') : '')).join(' '),
    youth: Array.from(e.children[2].children).map((c) => c.tagName + (c.getAttribute('vci-accordion') ? '.' + c.getAttribute('vci-accordion') : '')).join(' '),
    firstTrigger: e.querySelector('[vci-accordion="item"] [vci-accordion="trigger"]').className,
    hasIcon: !!e.querySelector('[vci-accordion="icon"] svg')
  }));
  ok(rt.ready === '1' && rt.sections === 3 && rt.items === 3, `richtext built 3 sections / 3 items (got ${rt.sections}/${rt.items})`);
  ok(rt.order === 'P', 'pre-H1 content boxed in its own section: ' + rt.order);
  ok(rt.kids === 'H4.title P DIV.group P', 'section keeps authored order, hr closes the row: ' + rt.kids);
  ok(rt.firstTrigger === 'acc-trigger' && rt.hasIcon, 'classes + chevron applied');
  ok(rt.youth === 'H4.title DIV.group P', 'blank paragraph closes the row and is dropped: ' + rt.youth);
  await ctx.close();
}

console.log('nav');
{
  const { page, ctx } = await open();
  ok(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim() === '56px'), '--header-height written');
  ok(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--nav-offset').trim() === '56px'), '--nav-offset written');
  await page.click('.w-nav-button');
  await page.waitForTimeout(50);
  ok(await page.$eval('[vci-nav="dim"]', (e) => e.classList.contains('is-open')), 'dim class follows w--open');
  ok(await page.evaluate(() => document.body.style.overflow === 'hidden'), 'menu locks scroll');
  await page.click('[vci-nav="dim"]');
  await page.waitForTimeout(50);
  ok(await page.$eval('[vci-nav="dim"]', (e) => !e.classList.contains('is-open')), 'clicking dim closes menu');
  ok(await page.evaluate(() => document.body.style.overflow === ''), 'unlocked after menu closes');
  await ctx.close();
}

console.log('scroll');
{
  const { page, ctx } = await open();
  ok(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior === 'smooth'), 'smooth scroll on');
  ok(await page.evaluate(() => !!document.querySelector('style[vci-style="scroll"]')?.textContent.includes('scroll-margin-top:var(--header-height, 0px)')), ':target offset injected');
  await ctx.close();
}

console.log('bundle isolation');
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto('file://' + join(root, 'test/fixtures/isolation.html'));
  ok(await page.evaluate(() => Object.keys(vci.modules).sort().join(',') === 'accordion,modal'), 'separate dist files share one core, load once each');
  ok(await page.evaluate(() => vci.version === '0.1.1'), 'version stamped');
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failure(s)` : '\nall good');
process.exit(failures ? 1 : 0);
