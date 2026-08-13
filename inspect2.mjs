import { chromium } from 'playwright-core';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.goto('http://localhost:3210/', { waitUntil: 'networkidle' });

// Find theme toggle mechanism
const themes = await page.evaluate(() => {
  const html = document.documentElement;
  const hasDarkClass = html.classList.contains('dark');
  const dataTheme = html.getAttribute('data-theme');
  const media = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const toggles = [...document.querySelectorAll('button')].filter(b => /tema|theme|claro|oscuro|light|dark/i.test(b.getAttribute('aria-label') || b.textContent || ''));
  return { hasDarkClass, dataTheme, mediaDark: media, toggles: toggles.slice(0,5).map(t => t.getAttribute('aria-label') || t.textContent) };
});
console.log('Theme state:', JSON.stringify(themes));

// Type and send a message, then check the user bubble text visibility
const input = page.locator('input[aria-label="Describe la propiedad que buscas"]');
await input.fill('casas con alberca');
await input.press('Enter');
await page.waitForTimeout(3000);

// Check the rendered user bubble
const bubbles = await page.evaluate(() => {
  const container = document.querySelector('input[aria-label="Describe la propiedad que buscas"]')?.closest('form')?.parentElement;
  if (!container) return null;
  const userMsgs = [...container.querySelectorAll('div')].filter(d => d.textContent && d.textContent.trim() === 'casas con alberca');
  return userMsgs.map(el => {
    const cs = getComputedStyle(el);
    return { text: el.textContent, color: cs.color, bg: cs.backgroundColor, cls: el.className };
  });
});
console.log('User bubbles:', JSON.stringify(bubbles, null, 2));
await page.screenshot({ path: '/tmp/chat-after-send.png' });
await browser.close();
