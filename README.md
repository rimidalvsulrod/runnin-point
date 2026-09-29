# Runnin' Point Podcast + Shop

The official Runnin' Point Podcast site and artist shop. The original animated podcast homepage remains static, while Vercel Functions power the store, secure admin panel, Stripe Connect onboarding, checkout, uploads and order tracking.

## Editing

Open `index.html` and look for the `EDIT HERE` block near the bottom:

- **LINKS**: the main link buttons. Any link whose `url` is `''` still shows but goes nowhere until you paste a URL in. The Spotify, Apple Podcasts and sponsor email links need filling in (for the email use `mailto:you@example.com`).
- **SOCIALS**: the round icon buttons. Instagram, TikTok and X need URLs.
- **EPISODES**: newest first. The first episode becomes the featured "Latest episode". Add `id: 'VIDEO_ID'` (the part after `watch?v=`) to link straight to that video and show its thumbnail.
- **VIDEO_COUNT**: the number on the stats row.

## Deploy

Import the repository into Vercel with Framework Preset set to **Other** and no build command. Every push to `main` redeploys the site.

Before opening the shop, configure the variables in `.env.example`, attach Vercel Blob, and add a serverless Postgres database such as Neon. Tables are created automatically on the first authenticated request.

Generate the admin password hash with:

```sh
npm install
node scripts/hash-password.js "your password"
```

Set the output as `ADMIN_PASSWORD_HASH`. Never commit `.env` or `.env.local`.

In Stripe, register a Connect webhook pointing to:

```
https://your-domain.example/api/stripe/webhook
```

Subscribe it to `account.updated`, `checkout.session.completed`, and `charge.refunded`. Use the signing secret as `STRIPE_WEBHOOK_SECRET`.

The shop is available at `/shop` and the private dashboard is at `/admin`.

If the site ends up on a domain other than `runnin-point.vercel.app`, update the `og:image` URL in `index.html` so link previews still show the image.

