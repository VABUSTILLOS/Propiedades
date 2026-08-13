import { chromium } from 'playwright-core';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3210/', { waitUntil: 'networkidle' });

// Toggle dark mode on <html>
await page.evaluate(() => {
  document.documentElement.classList.add('dark');
});

const input = page.locator('input[aria-label="Describe la propiedad que buscas"]');
const styles = await input.evaluate((el) => {
  const cs = getComputedStyle(el);
  return {
    color: cs.color,
    backgroundColor: cs.backgroundColor,
    caretColor: cs.caretColor,
    htmlClass: document.documentElement.className,
    htmlDataTheme: document.documentElement.getAttribute('data-theme'),
  };
});
console.log("DARK input styles:", JSON.stringify(styles, null, 2));
await input.fill('departamentos');
const after = await input.evaluate((el) => {
  const cs = getComputedStyle(el);
  return { color: cs.color, backgroundColor: cs.backgroundColor };
});
console.log("After typing in dark:", JSON.stringify(after));

// screenshot whole widget
const widget = input.evaluateHandle((el) => el.closest('form').parentElement);
const box = await page.locator('input[aria-label="Describe la propiedad que buscas"]').boundingBox();
console.log("Bounding box:", JSON.stringify(box));
await page.screenshot({ path: '/tmp/chat-widget-dark.png' });

await browser.close();
