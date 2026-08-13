import { chromium } from 'playwright-core';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.goto('http://localhost:3210/', { waitUntil: 'networkidle' });
const input = page.locator('input[aria-label="Describe la propiedad que buscas"]');
await input.fill('casas con alberca');
await input.press('Enter');
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const ps = [...document.querySelectorAll('p')].filter(p => p.textContent && p.textContent.trim() === 'casas con alberca');
  return ps.map(p => {
    const cs = getComputedStyle(p);
    return {
      tag: p.tagName,
      text: p.textContent.trim(),
      cls: p.className,
      color: cs.color,
      bgImage: cs.backgroundImage,
      bg: cs.backgroundColor,
      fontSize: cs.fontSize,
      fontFamily: cs.fontFamily,
      fontWeight: cs.fontWeight,
      opacity: cs.opacity,
      display: cs.display,
      visibility: cs.visibility,
      width: cs.width,
      height: cs.height,
      overflow: cs.overflow,
      textIndent: cs.textIndent,
      lineHeight: cs.lineHeight
    };
  });
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
