import { chromium } from 'playwright-core';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:3210/', { waitUntil: 'networkidle' });

// Find the chat input
const input = page.locator('input[aria-label="Describe la propiedad que buscas"]');
const count = await input.count();
console.log("Input found:", count);
if (count > 0) {
  const styles = await input.evaluate((el) => {
    const cs = getComputedStyle(el);
    const parent = el.parentElement;
    const pcs = parent ? getComputedStyle(parent) : null;
    return {
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      caretColor: cs.caretColor,
      fontSize: cs.fontSize,
      webkitTextFill: cs.webkitTextFillColor,
      opacity: cs.opacity,
      placeholder: cs.getPropertyValue('--tw-placeholder-color') || '',
      parentBg: pcs ? pcs.backgroundColor : null,
    };
  });
  console.log("Input computed styles:", JSON.stringify(styles, null, 2));

  // Type text
  await input.fill('casas en chihuahua');
  const val = await input.inputValue();
  console.log("Typed value:", JSON.stringify(val));
  const afterTyping = await input.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { color: cs.color, backgroundColor: cs.backgroundColor };
  });
  console.log("After typing:", JSON.stringify(afterTyping));

  // Screenshot
  await input.screenshot({ path: '/tmp/chat-input.png' });
}

// Also check the dark mode
const toggle = page.locator('[data-theme], .theme-toggle, [aria-label*="theme" i]').first();
console.log("Theme toggle count:", await page.locator('.theme-toggle').count());

await browser.close();
