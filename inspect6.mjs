import { chromium } from 'playwright-core';
const browser = await chromium.launch({ headless: true });

// Simulate OS dark preference but forced light theme
const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 1280, height: 1000 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3210/', { waitUntil: 'networkidle' });

// Force light theme by clicking "Tema claro"
const info = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter(b => (b.getAttribute('aria-label')||'').includes('claro'));
  const btn = btns[0];
  const out = { foundLightBtn: !!btn, htmlClass: document.documentElement.className, colorScheme: getComputedStyle(document.documentElement).colorScheme };
  if (btn) btn.click();
  return out;
});
await page.waitForTimeout(300);
const info2 = await page.evaluate(() => {
  const input = document.querySelector('input[aria-label="Describe la propiedad que buscas"]');
  const cs = getComputedStyle(input);
  return {
    htmlClass: document.documentElement.className,
    colorScheme: getComputedStyle(document.documentElement).colorScheme,
    inputColor: cs.color,
    inputBg: cs.backgroundColor,
    caret: cs.caretColor,
    textFill: cs.getPropertyValue('-webkit-text-fill-color'),
    bodyColor: getComputedStyle(document.body).color,
  };
});
console.log('Before:', JSON.stringify(info));
console.log('After forcing light:', JSON.stringify(info2, null, 2));

// Type text
await page.locator('input[aria-label="Describe la propiedad que buscas"]').fill('prueba');
await page.waitForTimeout(200);
await page.screenshot({ path: '/tmp/forced-light-darkscheme.png' });
await browser.close();
