import { expect, test } from '@playwright/test';

test('loads with no console errors, CSP violations or third-party requests', async ({ page, baseURL }) => {
  const problems: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') problems.push(m.text());
  });
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('request', (r) => {
    const url = new URL(r.url());
    if (url.protocol.startsWith('http') && url.origin !== new URL(baseURL!).origin) problems.push(`externo: ${r.url()}`);
  });
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP: ${e.violatedDirective} ${e.blockedURI}`));
  });

  await page.goto('/');
  await expect(page.getByTitle('Alternar tema')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('18px "Material Symbols Outlined"'))).toBe(true);

  expect(problems).toEqual([]);
});

test('exports the canvas as PNG under the production CSP', async ({ page }) => {
  const violations: string[] = [];
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP: ${e.violatedDirective}`));
  });
  page.on('console', (m) => {
    if (m.text().startsWith('CSP:')) violations.push(m.text());
  });
  await page.goto('/');
  await page.evaluate(() =>
    localStorage.setItem(
      'automaton-simulator:workspace',
      JSON.stringify({
        schemaVersion: 1,
        activeId: 'png',
        automatons: [
          {
            schemaVersion: 1,
            id: 'png',
            name: 'PNG',
            kind: 'DFA',
            alphabet: ['a'],
            states: [{ id: 'q0', label: 'q0', position: { x: 100, y: 100 }, isStart: true, isAccept: false }],
            transitions: [{ id: 't', from: 'q0', to: 'q0', input: 'a' }],
            startStateId: 'q0',
          },
        ],
      }),
    ),
  );
  await page.reload();

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByTitle('Exportar como PNG').click()]);
  expect(download.suggestedFilename()).toBe('PNG.png');
  expect(violations).toEqual([]);
});
