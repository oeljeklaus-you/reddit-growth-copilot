# Reddit Growth Copilot Site Replacement Guide

This document lists the placeholders and assets you may want to replace before launch.

## 1. Site URL

Update the production domain in:

- [app/site.ts](/D:/reddit-growth-copilot/reddit-growth-copilot-site/app/site.ts)

Change:

```ts
export const SITE_URL = "https://reddit-growth-copilot.vercel.app";
```

Use your real Vercel domain or custom domain.

This value is reused by:

- canonical URLs
- `robots.txt`
- `sitemap.xml`
- JSON-LD structured data

## 2. Chrome Web Store URL

The Chrome Web Store URL is centralized in:

- [app/site.ts](/D:/reddit-growth-copilot/reddit-growth-copilot-site/app/site.ts)

Current value:

```ts
export const CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/reddit-growth-copilot/fnlbicpmajhmdcnhcbdmomdkakllgfaf";
```

Only change this if the official store listing URL changes.

## 3. Privacy Contact Email

Replace the placeholder email in:

- [app/privacy/page.tsx](/D:/reddit-growth-copilot/reddit-growth-copilot-site/app/privacy/page.tsx)

Current placeholder:

```txt
your-email@example.com
```

Replace it with your real support or contact email.

## 4. Privacy Policy Last Updated Date

Update the date in:

- [app/site.ts](/D:/reddit-growth-copilot/reddit-growth-copilot-site/app/site.ts)

Current value:

```ts
export const LAST_UPDATED = "2026-05-09";
```

This is displayed on:

- [app/privacy/page.tsx](/D:/reddit-growth-copilot/reddit-growth-copilot-site/app/privacy/page.tsx)

## 5. Hero Screenshot

The hero image now uses a real screenshot from:

- [public/screenshots/hero-panel.png](/D:/reddit-growth-copilot/reddit-growth-copilot-site/public/screenshots/hero-panel.png)

Rendered in:

- [app/page.tsx](/D:/reddit-growth-copilot/reddit-growth-copilot-site/app/page.tsx)

Current source mapping:

- `png/1.png` -> `public/screenshots/hero-panel.png`

If you capture a better hero image later, replace this file with a new PNG using the same filename.

## 6. Screenshot Section Images

The screenshot section currently uses:

- [public/screenshots/active-threads.png](/D:/reddit-growth-copilot/reddit-growth-copilot-site/public/screenshots/active-threads.png)
- [public/screenshots/fake-active-risk.png](/D:/reddit-growth-copilot/reddit-growth-copilot-site/public/screenshots/fake-active-risk.png)
- [public/screenshots/reply-timing.png](/D:/reddit-growth-copilot/reddit-growth-copilot-site/public/screenshots/reply-timing.png)

Configured in:

- [app/page.tsx](/D:/reddit-growth-copilot/reddit-growth-copilot-site/app/page.tsx)

Current mapping from your original `png` folder:

- `png/2.png` -> `active-threads.png`
- `png/3.png` -> `fake-active-risk.png`
- `png/4.png` -> `reply-timing.png`
- `png/5.png` -> `extra-panel.png` (currently not shown on the page)

If you want to replace them later, either:

1. Overwrite the files in `public/screenshots/` with the same filenames.
2. Or update the image paths in [app/page.tsx](/D:/reddit-growth-copilot/reddit-growth-copilot-site/app/page.tsx).

## 7. Optional Screenshot Reordering

If you want different screenshots in different sections, update the screenshot card mapping in:

- [app/page.tsx](/D:/reddit-growth-copilot/reddit-growth-copilot-site/app/page.tsx)

Look for the `screenshotCards` array and change:

- `title`
- `src`
- `alt`

## 8. Optional Copy Updates

If you want to refine launch copy later, the main shared copy constants are in:

- [app/site.ts](/D:/reddit-growth-copilot/reddit-growth-copilot-site/app/site.ts)

Examples:

- `HOME_TITLE`
- `HOME_DESCRIPTION`
- `HOME_OG_TITLE`
- `HOME_OG_DESCRIPTION`
- `PRIVACY_TITLE`
- `PRIVACY_DESCRIPTION`

## 9. Launch Checklist

Before launch, the highest-priority replacements are:

1. Replace `SITE_URL` with the real domain.
2. Replace the privacy contact email.
3. Confirm the hero screenshot is the best product screenshot.
4. Confirm the three screenshot section images are the best examples.
5. Update `LAST_UPDATED` if you edit privacy text again.

## 10. After Replacing Anything

Run:

```bash
npm run build
```

Then verify:

- `/`
- `/privacy`
- `/robots.txt`
- `/sitemap.xml`

