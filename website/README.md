# Pav Marketing Website

Next.js 14 + Tailwind CSS marketing site for the Pav mobile app.

## Develop locally

```bash
cd website
yarn install
yarn dev
# open http://localhost:3100
```

## Deploy to Vercel

1. Push the repo to GitHub.
2. Go to vercel.com → New Project → import the repo.
3. Set **Root Directory** = `website` (since the site lives in a subfolder).
4. Click Deploy. Vercel auto-detects Next.js.
5. After deploy, go to Project → Settings → Domains → add `pavapp.com`.
6. In Cloudflare DNS, add a CNAME record `pavapp.com → cname.vercel-dns.com`.
7. SSL is automatic — your site is live in ~10 minutes.

## Pages

- `/` — Home (hero + features + how it works + pricing + FAQ)
- `/privacy` — Privacy Policy
- `/terms` — Terms of Service

## Customization

Update the constants at the top of `app/page.tsx` and `components/Footer.tsx` for:
- Contact email
- Domain / canonical URL
- App Store / Play Store URLs (paste them in once your app is approved)
