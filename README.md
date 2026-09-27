# Runnin' Point Podcast

The official Runnin' Point Podcast site, built to replace the Linktree. It's a single static page with no build step. `index.html` holds everything (styles, animations and content), and the fonts and photos are in `assets/`.

## Editing

Open `index.html` and look for the `EDIT HERE` block near the bottom:

- **LINKS**: the main link buttons. Any link whose `url` is `''` still shows but goes nowhere until you paste a URL in. The Spotify, Apple Podcasts and sponsor email links need filling in (for the email use `mailto:you@example.com`).
- **SOCIALS**: the round icon buttons. Instagram, TikTok and X need URLs.
- **EPISODES**: newest first. The first episode becomes the featured "Latest episode". Add `id: 'VIDEO_ID'` (the part after `watch?v=`) to link straight to that video and show its thumbnail.
- **VIDEO_COUNT**: the number on the stats row.

## Deploy

The repo deploys on Vercel with zero configuration. Import it with Framework Preset set to "Other" and no build command. Every push to `main` redeploys the site.

If the site ends up on a domain other than `runnin-point.vercel.app`, update the `og:image` URL in `index.html` so link previews still show the image.
