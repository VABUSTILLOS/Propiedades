import { chromium } from 'playwright-core';

const browser = await chromium.launch({ headless: true });

async function probe(themeName, setupDark) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto('http://localhost:3210/', { waitUntil: 'networkidle' });
  if (setupDark) {
    await page.evaluate(() => {
      // click dark toggle button
      const btn = [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label')||'').includes('oscuro') || (b.textContent||'').includes('Tema oscuro'));
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
  }
  const input = page.locator('input[aria-label="Describe la propiedad que buscas"]');
  await input.fill('Hola');
  const info = await input.evaluate(el => {
    const cs = getComputedStyle(el);
    const props = ['color','backgroundColor','caretColor','-webkit-text-fill-color','fontSize','fontWeight','opacity','textShadow','WebkitTextStrokeColor','visibility','fontFamily'];
    const out = {};
    props.forEach(p => out[p] = cs.getPropertyValue(p));
    // placeholder
    const ps = getComputedStyle(el, '::placeholder');
    out['placeholder-color'] = ps.color;
    out['placeholder-opacity'] = ps.opacity;
    out['placeholder-text-fill'] = ps.getPropertyValue('-webkit-text-fill-color');
    // selection
    const ss = getComputedStyle(el, '::selection');
    out['selection-color'] = ss.color;
    out['selection-bg'] = ss.backgroundColor;
    // keyframes / animations on element
    out['animationName'] = cs.animationName;
    out['animationDuration'] = cs.animationDuration;
    return out;
  });
  const htmlDark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  const colorScheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  console.log(`\n===== ${themeName} (html.dark=${htmlDark}, colorScheme=${colorScheme}) =====`);
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: `/tmp/input-${themeName}.png` });
  await page.close();
}

await probe('light', false);
await probe('dark', true);
await browser.close();
