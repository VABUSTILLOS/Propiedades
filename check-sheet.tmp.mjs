import { chromium } from 'playwright-core';
const browser = await chromium.launch({
  executablePath: '/Users/mac/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 320, height: 800 } });
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1200);
// find the hamburger button (mobile menu toggle)
const btns = await page.locator('button').allTextContents();
console.log('Buttons on page:', JSON.stringify(btns.slice(0,12)));
const menuBtn = page.locator('button[aria-label*="menu" i], button[aria-label*="Menu"], button:has(svg)').last();
try {
  await menuBtn.click();
  await page.waitForTimeout(800);
  const sheetText = await page.locator('[role="dialog"], [data-slot="sheet-content"]').first().textContent();
  console.log('Sheet open, contains "Crear cuenta":', sheetText?.includes('Crear cuenta'), '| "Iniciar sesión":', sheetText?.includes('Iniciar sesión'));
  const doc = await page.evaluate(() => document.documentElement.scrollWidth);
  console.log('Sheet open docWidth:', doc);
} catch (e) {
  console.log('Sheet click error:', e.message.slice(0,80));
}
await browser.close();
