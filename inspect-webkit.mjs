import { webkit } from 'playwright-core';
const browser = await webkit.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
await page.goto('http://localhost:3210/', { waitUntil: 'networkidle' });

const input = page.locator('input[aria-label="Describe la propiedad que buscas"]');
await input.fill('Hola prueba');
await page.waitForTimeout(300);

const info = await input.evaluate(el => {
  const cs = getComputedStyle(el);
  return {
    color: cs.color,
    bg: cs.backgroundColor,
    caretColor: cs.caretColor,
    textFill: cs.getPropertyValue('-webkit-text-fill-color'),
    fontSize: cs.fontSize,
    fontFamily: cs.fontFamily,
    opacity: cs.opacity,
    visibility: cs.visibility,
    colorScheme: cs.colorScheme,
  };
});
console.log('INPUT (light):', JSON.stringify(info, null, 2));

const ph = await input.evaluate(el => {
  const ps = getComputedStyle(el, '::placeholder');
  return { color: ps.color, opacity: ps.opacity, textFill: ps.getPropertyValue('-webkit-text-fill-color') };
});
console.log('PLACEHOLDER:', JSON.stringify(ph, null, 2));

await page.screenshot({ path: '/tmp/chat-webkit-light.png' });
await browser.close();
