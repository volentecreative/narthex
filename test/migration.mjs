// Proves the attribute map in docs/migration-thenorthchurch.md against markup
// shaped like the site's own (Webflow navbar, prop-bound drawer key, CMS-bound
// team modal, div-based FAQ accordion, rich-text field) — before touching the
// Designer. Run: node test/migration.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = 'file://' + join(root, 'test/fixtures/migration-thenorthchurch.html');
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
const vis = (page, sel) => page.$eval(sel, (e) => e.classList.contains('is-visible'));

console.log('navbar');
{
  const { page, ctx, errors } = await open();
  ok(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--header-height').trim() === '64px'), 'vci-nav="header" writes --header-height');
  await page.click('.w-nav-button'); await page.waitForTimeout(30);
  ok(await page.$eval('.navbar_menu-dim', (e) => e.classList.contains('navbar_menu-dim-open')), 'dim gets navbar_menu-dim-open while w--open');
  ok(await page.evaluate(() => document.body.style.overflow === 'hidden'), 'menu locks scroll');
  await page.click('.navbar_menu-dim'); await page.waitForTimeout(30);
  ok(await page.$eval('.w-nav-button', (e) => !e.classList.contains('w--open')), 'dim click closes the Webflow menu');
  ok(await page.evaluate(() => document.body.style.overflow === ''), 'unlocked');
  ok(errors.length === 0, 'no page errors');
  await ctx.close();
}

console.log('modals');
{
  const { page, ctx } = await open();
  await page.click('.navbar_link.emphasize');
  ok(await vis(page, '[vci-modal-key="connect"][vci-modal="dialog"]'), 'navbar Connect opens modal-connect');
  ok(await page.evaluate(() => new URL(location.href).searchParams.get('modal') === 'connect'), '?modal=connect written');
  await page.click('[vci-modal-key="connect"][vci-modal="dialog"] .close-wrapper');
  ok(!(await vis(page, '[vci-modal-key="connect"][vci-modal="dialog"]')), 'close-wrapper div closes it');
  await page.click('#button-connect');
  ok(await vis(page, '[vci-modal-key="connect"][vci-modal="dialog"]'), 'button component with Open Modal prop opens it');
  await page.keyboard.press('Escape');
  await page.click('.navbar_link[vci-modal-key="north-update"]');
  ok(await vis(page, '[vci-modal-key="north-update"][vci-modal="dialog"]'), 'north-update opens');
  await page.keyboard.press('Escape');
  const before = page.url();
  await page.click('#plain-button').catch(() => {});
  await page.waitForTimeout(50);
  ok(page.url() !== before || page.url().includes('/give'), 'button with empty Open Modal prop stays an ordinary link: ' + page.url());
  await ctx.close();
}
{
  const { page, ctx } = await open('?modal=north-update');
  ok(await vis(page, '[vci-modal-key="north-update"][vci-modal="dialog"]'), '?modal=north-update deep link opens on load');
  await ctx.close();
}

console.log('team modal (CMS-bound key on a div trigger)');
{
  const { page, ctx } = await open();
  await page.click('#card-jane');
  ok(await vis(page, '#jane-doe'), 'collection-item trigger opens the member modal');
  ok(await page.$eval('#field-2', (e) => e.value === 'Jane Doe'), 'hidden field filled from vci-modal="title"');
  await page.click('[data-team-contact-toggle]');
  ok(await page.$eval('[data-team-contact-form]', (e) => e.classList.contains('is-open')), 'Contact toggle still works via the footer mini-script');
  await page.click('#jane-doe .close-wrapper');
  ok(!(await vis(page, '#jane-doe')), 'close');
  ok(await page.evaluate(() => document.activeElement === document.querySelector('#card-jane a')), 'focus restored to the link inside the div trigger');
  await ctx.close();
}

console.log('search modal (still owned by its handler)');
{
  const { page, ctx } = await open();
  await page.click('.search-button');
  ok(await vis(page, '#search-shell'), 'data-modal-open="search" opens via the handler');
  await page.click('#search-shell .icon-button');
  ok(!(await vis(page, '#search-shell')), 'handler close works');
  await page.click('.navbar_link.emphasize'); await page.keyboard.press('Escape');
  ok(await page.evaluate(() => document.body.style.overflow === ''), 'narthex lock is clean afterwards');
  await ctx.close();
}

console.log('drawer (prop-bound key, inline on desktop)');
{
  const { page, ctx } = await open();
  await page.click('#open-filters');
  ok(await vis(page, '.drawer') && await vis(page, '.drawer_panel'), 'drawer + panel open');
  ok(await page.evaluate(() => !new URL(location.href).searchParams.has('modal')), 'no URL param for drawers');
  ok(await page.$eval('#open-filters', (e) => e.getAttribute('aria-expanded') === 'true'), 'trigger aria-expanded');
  await page.click('.drawer [vci-modal="scrim"]', { position: { x: 4, y: 4 } });
  ok(!(await vis(page, '.drawer')), 'scrim click closes');
  await page.click('#open-filters');
  await page.click('.drawer .icon-button');
  ok(!(await vis(page, '.drawer')), 'close button closes');
  await ctx.close();
}
{
  const { page, ctx } = await open('', { width: 1200, height: 800 });
  await page.click('#open-filters');
  ok(!(await vis(page, '.drawer')), 'desktop: drawer is inline, never opens');
  await ctx.close();
}

console.log('accordions');
{
  const { page, ctx } = await open();
  ok(await page.$eval('#faq-1 .accordion-heading', (e) => e.getAttribute('role') === 'button' && e.getAttribute('tabindex') === '0' && e.getAttribute('aria-expanded') === 'false'), 'div heading made keyboard-operable');
  await page.click('#faq-1 .accordion-body-text', { force: true }).catch(() => {});
  await page.click('#faq-1 .accordion-heading');
  ok(await page.$eval('#faq-1', (e) => e.classList.contains('is-open')), 'FAQ item opens with is-open (site CSS hook)');
  await page.waitForTimeout(350);
  ok(await page.$eval('#faq-1 .accordion-body', (e) => getComputedStyle(e).gridTemplateRows !== '0px'), 'body expanded');
  await page.click('#faq-1 .accordion-heading');
  ok(await page.$eval('#faq-1', (e) => !e.classList.contains('is-open')), 'closes on heading click');
  await page.focus('#faq-2 .accordion-heading'); await page.keyboard.press('Enter');
  ok(await page.$eval('#faq-2', (e) => e.classList.contains('is-open')), 'Enter on heading opens (new: keyboard support)');
  const rt = await page.$eval('#opps', (e) => ({
    sections: e.querySelectorAll('[vci-accordion="section"]').length,
    item: e.querySelector('.accordion-item') && e.querySelector('.accordion-item').getAttribute('vci-accordion'),
    trig: e.querySelector('button.accordion-heading.text-size-regular') && e.querySelector('button.accordion-heading').getAttribute('vci-accordion'),
    stack: !!e.querySelector('.accordion-item > .vert-flex > h5.acc-item-heading + .accordion-body > .accordion-body-inner > .accordion-body-text'),
    title: e.querySelector('h4.acc-section-title') && e.querySelector('h4.acc-section-title').textContent,
    icon: !!e.querySelector('.icon-regular svg'),
    closing: e.children[0].lastElementChild.textContent,
    closing2: e.children[1].lastElementChild.textContent,
    youthItems: e.children[1].querySelectorAll('[vci-accordion="item"]').length
  }));
  ok(rt.sections === 2 && rt.item === 'item' && rt.trig === 'trigger', 'rich text rebuilt with narthex roles');
  ok(rt.closing2 === 'Closing two.' && rt.youthItems === 1, 'empty paragraph closes the row (matches the live embed)');
  ok(rt.stack && rt.title === 'Kids' && rt.icon, 'rich text markup matches the old builder (vert-flex stack, h4/h5, classes, chevron)');
  ok(rt.closing === 'Closing.', 'hr closes the row; closing paragraph stays on the page');
  await page.click('#opps button.accordion-heading');
  ok(await page.$eval('#opps .accordion-item', (e) => e.classList.contains('is-open')), 'rich text row toggles');
  await ctx.close();
}

console.log('scroll');
{
  const { page, ctx } = await open();
  ok(await page.evaluate(() => document.querySelector('style[vci-style="scroll"]').textContent.includes('calc(var(--header-height) + var(--_spacing---gutter))')), 'offset keeps the gutter');
  ok(await page.evaluate(() => Array.isArray(window.Webflow) && window.Webflow.length === 1), 'Webflow.push queued to remove click.wf-scroll');
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failure(s)` : '\nall good');
process.exit(failures ? 1 : 0);
