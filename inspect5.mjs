import { chromium } from 'playwright-core';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.goto('http://localhost:3210/', { waitUntil: 'networkidle' });
const input = page.locator('input[aria-label="Describe la propiedad que buscas"]');
await input.fill('Hola');

const info = await page.evaluate(() => {
  const el = document.querySelector('input[aria-label="Describe la propiedad que buscas"]');
  const rect = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  // All elements overlapping the input center point, ordered by z-index
  const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
  const overlapping = [...document.querySelectorAll('body *')].filter(e => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  }).map(e => {
    const s = getComputedStyle(e);
    return { tag: e.tagName, cls: String(e.className).slice(0,80), z: s.zIndex, pos: s.position, bg: s.backgroundColor, pointer: s.pointerEvents, opacity: s.opacity, mix: s.mixBlendMode };
  }).sort((a,b) => (parseInt(b.z)||0)-(parseInt(a.z)||0));
  return {
    inputRect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    inputBg: cs.backgroundColor,
    inputBgImage: cs.backgroundImage,
    inputBoxShadow: cs.boxShadow,
    overlapping: overlapping.slice(0, 15)
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: '/tmp/input-region.png' });
await browser.close();
