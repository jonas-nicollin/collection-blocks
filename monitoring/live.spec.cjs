const { test, expect } = require('@playwright/test');

// Site-owned URLs and editorial labels live in a repository variable, not here.
const targets = JSON.parse(process.env.CB_MONITOR_TARGETS || '[]');
if (!Array.isArray(targets) || !targets.length) {
  throw new Error('Set CB_MONITOR_TARGETS to a non-empty JSON array of public page checks.');
}

for (const target of targets) {
  test(target.name, async ({ page, isMobile }) => {
    const response = await page.goto(target.url, { waitUntil: 'domcontentloaded' });
    expect(response?.ok(), 'Public page must respond successfully').toBeTruthy();
    await expect(page.locator('main')).toBeVisible();

    if (target.kind === 'query') {
      await expect(page.locator('.qb-card').first()).toBeVisible();
      await page.getByRole('button', { name: target.filter, exact: true }).click();
      await expect.poll(() => new URL(page.url()).searchParams.get(target.filterParam))
        .toBe(target.filter);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.locator('.qb-card').first()).toBeVisible();
      await expect(page.getByRole('button', { name: target.filter, exact: true }))
        .toHaveClass(/qb-filter-btn--active/);
    } else if (target.kind === 'locator') {
      await expect(page.locator('.lb-card').first()).toBeAttached();
      await expect(page.locator('.gm-style').first()).toBeVisible();
      if (isMobile) {
        await page.getByRole('button', { name: 'Agrandir la liste', exact: true }).click();
        await page.getByRole('combobox', { name: 'Filtrer par catégorie' })
          .selectOption({ label: target.filter });
      } else {
        await page.getByRole('button', { name: target.filter, exact: true }).click();
      }
      await expect.poll(() => new URL(page.url()).searchParams.get(target.filterParam))
        .toBe(target.filter);
      await page.locator('.cb-route-planner__summary').click();
      await expect(page.locator('.cb-route-planner__stop')).toHaveCount(4);
      await expect(page.locator('.cb-route-planner__duration'))
        .toHaveText(/^(\d+h\d{2}|\d+ min\.)$/);
      const maps = page.getByRole('link', { name: 'Ouvrir dans Google Maps', exact: true });
      await expect(maps).toBeVisible();
      const mapsUrl = new URL(await maps.getAttribute('href'));
      expect(mapsUrl.searchParams.get('waypoints').split('|')).toHaveLength(3);
      expect(mapsUrl.searchParams.get('destination_place_id')).toBeTruthy();
      const before = await page.locator('.cb-route-planner__name').allTextContents();
      const third = page.locator('.cb-route-planner__stop').nth(2);
      if (!isMobile) await third.hover();
      await third.locator('[data-route-action="up"]').click();
      await expect(page.locator('.cb-route-planner__name').nth(1)).toHaveText(before[2]);
      await page.getByRole('button', { name: 'En voiture', exact: true }).click();
      await expect.poll(() => new URL(page.url()).searchParams.get('transport'))
        .toBe('driving');
      await expect(page.locator('.cb-route-planner__duration'))
        .toHaveText(/^(\d+h\d{2}|\d+ min\.)$/);
      await page.getByRole('button', { name: 'Copier le lien du parcours', exact: true })
        .click();
      // A browser that denies clipboard access must provide a selectable URL instead.
      await expect.poll(async () => {
        const status = await page.locator('.cb-route-planner__status').textContent();
        const fallback = page.locator('.cb-route-planner__share-url');
        return status === 'Lien copié' || await fallback.isVisible();
      }).toBeTruthy();
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.locator('.cb-route-planner__summary').click();
      await expect(page.locator('.cb-route-planner__name').nth(1)).toHaveText(before[2]);
      await expect(page.getByRole('button', { name: 'En voiture', exact: true }))
        .toHaveAttribute('aria-pressed', 'true');
    } else if (target.kind === 'member') {
      await expect(page.locator('.cb-banner__title')).toHaveText(target.title);
      await expect(page.locator('.locb-card').first()).toBeVisible();
      await expect(page.locator('.mb-elements').first()).not.toBeEmpty();
      await expect(page.locator('.cb-banner__back-link')).toHaveAttribute('href',
        new URL(target.backPath, target.url).href);
      await expect.poll(() => page.locator('.cb-banner__image').evaluate(image =>
        image.complete && image.naturalWidth > 0)).toBeTruthy();
    } else if (target.kind === 'gallery') {
      await expect(page.locator('.cb-banner__back-link')).toHaveAttribute('href',
        new URL(target.backPath, target.url).href);
      await expect(page.locator('.mb-elements').first()).not.toBeEmpty();
      const gallery = page.locator('.sqs-gallery-design-grid').first();
      const slides = gallery.locator(':scope > .sqs-gallery-design-grid-slide');
      await expect(slides).toHaveCount(1);
      await slides.first().scrollIntoViewIfNeeded();
      const ratio = await slides.first().evaluate(slide =>
        slide.getBoundingClientRect().width / slide.parentElement.getBoundingClientRect().width);
      expect(ratio).toBeLessThanOrEqual(0.51);
      const link = slides.first().locator('.image-slide-anchor');
      await expect(link).toHaveCSS('border-radius', '0px');
      await link.click();
      await expect(page.locator('.fancybox__container')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.fancybox__container')).toHaveCount(0);
    } else {
      throw new Error(`Unknown monitor kind: ${target.kind}`);
    }
  });
}
