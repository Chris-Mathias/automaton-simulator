import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const WORKSPACE_KEY = 'automaton-simulator:workspace';
const CRASH_MARKER = '__e2e_crash__';

/**
 * A valid workspace whose only oddity is the marker in the automaton name.
 * Validation rightly lets it through, so on its own it loads fine.
 */
const markedWorkspace = JSON.stringify({
  schemaVersion: 1,
  activeId: 'e2e',
  automatons: [
    {
      schemaVersion: 1,
      id: 'e2e',
      name: CRASH_MARKER,
      kind: 'DFA',
      alphabet: ['a'],
      states: [{ id: 'q0', label: 'q0', position: { x: 100, y: 100 }, isStart: true, isAccept: true }],
      transitions: [],
      startStateId: 'q0',
    },
  ],
});

/**
 * Stands in for an unknown rendering bug triggered by saved data: while the
 * marked workspace is in storage, the app's keydown registration (done in an
 * effect) throws. Clearing the workspace removes the trigger, just as it
 * would for a real corrupted state.
 */
async function injectWorkspaceBug(page: Page) {
  await page.addInitScript(
    ({ key, marker }) => {
      const original = window.addEventListener;
      window.addEventListener = function (this: Window, ...args: Parameters<typeof original>) {
        if (args[0] === 'keydown' && (localStorage.getItem(key) ?? '').includes(marker)) {
          throw new Error('Falha simulada pelo teste E2E');
        }
        return original.apply(this, args);
      } as typeof original;
    },
    { key: WORKSPACE_KEY, marker: CRASH_MARKER },
  );
}

async function openWithBrokenWorkspace(page: Page) {
  await injectWorkspaceBug(page);
  await page.goto('/');
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [WORKSPACE_KEY, markedWorkspace]);
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Algo deu errado');
}

test('a crash shows the recovery screen instead of a blank page', async ({ page }) => {
  await openWithBrokenWorkspace(page);
  await expect(page.getByRole('alert')).toContainText('Falha simulada pelo teste E2E');
  await expect(page.getByTitle('Alternar tema')).toHaveCount(0);
});

test('reloading alone does not get out of a crash caused by saved data', async ({ page }) => {
  await openWithBrokenWorkspace(page);
  await page.getByRole('button', { name: 'Recarregar' }).click();
  await expect(page.getByRole('alert')).toContainText('Algo deu errado');
});

test('the backup download holds exactly what is saved', async ({ page }) => {
  await openWithBrokenWorkspace(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Baixar backup' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('backup-workspace-automatos.json');
  expect(await readFile(await download.path(), 'utf8')).toBe(markedWorkspace);
});

test('cancelling the reset keeps the saved workspace', async ({ page }) => {
  await openWithBrokenWorkspace(page);
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Limpar workspace' }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), WORKSPACE_KEY)).toBe(markedWorkspace);
});

test('confirming the reset clears the workspace and brings the app back', async ({ page }) => {
  await openWithBrokenWorkspace(page);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Limpar workspace' }).click();

  await expect(page.getByTitle('Alternar tema')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('Meu autômato')).toBeVisible();
  const saved = await page.evaluate((key) => localStorage.getItem(key), WORKSPACE_KEY);
  expect(saved ?? '').not.toContain(CRASH_MARKER);
});
