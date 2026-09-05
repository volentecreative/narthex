// Proves the attribute map in docs/migration-christtheking.md against markup
// shaped like the live site's own — a hand-built navbar with no Webflow .w-nav
// anywhere, the ported modal component, the div-based FAQ accordion — before
// touching the Designer. Run: node test/migration-christtheking.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = 'file://' + join(root, 'test/fixtures/migration-christtheking.html');
let failures = 0;
const ok = (c, m) => { if (c) console.log('  ✓', m); else { failures++; console.log('  ✗', m); } };
const browser = await chromium.launch({ headless: true });
async function open(q = '', viewport = { width: 400, height: 800 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url + q);
  return { page, ctx, errors };
}
const cls = (page, sel, c) => page.$eval(sel, (e, c) => e.classList.contains(c), c);

console.log('header measurement (the --nav-height contract the site CSS already uses)');
{
  const { page, ctx, errors } = await open();
  ok(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--nav-height').trim() === '72px'),
    'vci-nav-height-var keeps the site variable name --nav-height');
  ok(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--nav-offset').trim() === '112px'),
    '--nav-offset is the header bottom edge, announcement bar included');

  // The old inline script only ever wrote a height. The offset tracks scroll,
  // which is what the sticky menu actually wants once the bar scrolls away.
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
  await page.waitForTimeout(100);
  ok(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--nav-offset').trim() === '72px'),
    '--nav-offset follows the sticky header once the announcement bar scrolls off');
  ok(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--nav-height').trim() === '72px'),
    '--nav-height stays the header height');
  ok(errors.length === 0, 'no page errors');
  await ctx.close();
}

console.log('mobile menu (a hand-built hamburger, no .w-nav on the site)');
{
  const { page, ctx } = await open();
  ok(await page.$eval('[vci-nav="toggle"]', (e) => e.getAttribute('role') === 'button' && e.getAttribute('tabindex') === '0'),
    'the div hamburger is made focusable and announced as a button');

  await page.click('[vci-nav="toggle"]');
  await page.waitForTimeout(30);
  ok(await cls(page, '.navbar_menu', 'is-open'), 'toggle opens .navbar_menu');
  ok(await cls(page, '.navbar_dim', 'is-open'), 'the dim follows the menu');
  ok(await page.$eval('[vci-nav="toggle"]', (e) => e.getAttribute('aria-expanded') === 'true'), 'toggle reports aria-expanded');
  ok(await page.evaluate(() => document.body.style.overflow === 'hidden'), 'the menu holds the shared scroll lock');

  await page.click('.navbar_dim');
  await page.waitForTimeout(30);
  ok(!(await cls(page, '.navbar_menu', 'is-open')), 'dim click closes the menu');
  ok(await page.evaluate(() => document.body.style.overflow === ''), 'lock released');

  await page.click('[vci-nav="toggle"]');
  await page.waitForTimeout(30);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(30);
  ok(!(await cls(page, '.navbar_menu', 'is-open')), 'Escape closes the menu');

  // Enter on the promoted div, the keyboard path the site does not have today
  await page.focus('[vci-nav="toggle"]');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(30);
  ok(await cls(page, '.navbar_menu', 'is-open'), 'Enter on the hamburger opens the menu (new)');

  await page.click('.navbar_menu a[href="#beliefs"]', { noWaitAfter: true });
  await page.waitForTimeout(30);
  ok(!(await cls(page, '.navbar_menu', 'is-open')), 'following a link inside the menu closes it');
  await ctx.close();
}

console.log('modal component');
{
  const { page, ctx } = await open();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.click('[vci-nav="toggle"]');
  await page.waitForTimeout(30);
  await page.click('[vci-modal="open"][vci-modal-key="connect"]');
  await page.waitForTimeout(30);
  ok(await cls(page, '#connect', 'is-visible'), 'Connect opens the modal keyed by its Modal ID');
  ok(await page.$eval('#connect', (e) => !e.hasAttribute('vci-modal-key')),
    'the host carries no key attribute — it resolved by DOM id alone');
  ok(await page.evaluate(() => new URL(location.href).searchParams.get('modal') === 'connect'), '?modal=connect written');

  await page.click('#connect [vci-modal="close"]');
  await page.waitForTimeout(30);
  ok(!(await cls(page, '#connect', 'is-visible')), 'the modal_close link closes it');
  ok(await page.evaluate(() => !new URL(location.href).searchParams.has('modal')), '?modal cleared');
  await ctx.close();
}
{
  const { page, ctx } = await open('?modal=connect');
  await page.waitForTimeout(50);
  ok(await cls(page, '#connect', 'is-visible'), '?modal=connect deep link still opens it');
  await page.click('.modal-dim');
  await page.waitForTimeout(30);
  ok(!(await cls(page, '#connect', 'is-visible')), 'the scrim closes it');
  await ctx.close();
}

console.log('FAQ accordion');
{
  const { page, ctx } = await open();
  ok(await page.$eval('.faq_answer', (e) => e.getAttribute('vci-accordion-state') === 'closed' && e.getAttribute('aria-hidden') === 'true'),
    'closed answer is hidden from assistive tech');
  await page.click('.faq_toggle');
  await page.waitForTimeout(30);
  ok(await cls(page, '.faq_item', 'is-open'), 'the item keeps the .is-open hook the site CSS uses');
  ok(await page.$eval('.faq_answer', (e) => e.getAttribute('vci-accordion-state') === 'open'), 'the answer opens via vci-accordion-state, not a class');
  ok(await page.$eval('.faq_toggle', (e) => e.getAttribute('aria-expanded') === 'true'), 'trigger reports aria-expanded');
  await page.waitForTimeout(400);
  ok(await page.$eval('.faq_answer', (e) => e.getBoundingClientRect().height > 10), 'the built-in grid-rows collapse actually expands it');

  // The old script also put .is-open on the answer and the icon; narthex does
  // not, which is why those two CSS rules have to move to the state attribute.
  ok(!(await cls(page, '.faq_answer', 'is-open')), 'the answer no longer gets .is-open');
  ok(!(await cls(page, '.faq_icon', 'is-open')), 'the icon no longer gets .is-open');

  await page.click('.faq_toggle');
  await page.waitForTimeout(30);
  ok(!(await cls(page, '.faq_item', 'is-open')), 'clicking the toggle closes it');
  await page.focus('.faq_toggle');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(30);
  ok(await cls(page, '.faq_item', 'is-open'), 'Enter opens it');
  await ctx.close();
}

console.log('scroll');
{
  const { page, ctx } = await open();
  ok(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior === 'smooth'), 'native smooth scroll on');
  ok(await page.evaluate(() => {
    const s = [...document.querySelectorAll('style[vci-style="scroll"]')].map((e) => e.textContent).join('');
    return s.includes('scroll-margin-top:calc(var(--nav-height, 4.5rem) + 1.5rem)');
  }), 'anchor offset keeps the site\'s nav-height + gutter');
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failed` : '\nall good');
process.exit(failures ? 1 : 0);
