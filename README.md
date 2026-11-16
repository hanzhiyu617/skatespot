# skatespot

A Korean skate-spot directory with a Leaflet/OpenStreetMap map, three-language spot names and descriptions, direct community submissions, ratings, and admin deletion.

## Deploy to Vercel

The Vercel deployment uses Vercel Functions for the API and PostgreSQL for persistent data. It does not use a local JSON file as a database.

1. Push this project to GitHub and import the repository into Vercel.
2. Add a PostgreSQL database through the Vercel Marketplace (Neon is supported). Make its pooled connection string available as `DATABASE_URL` to the Production build and Functions. `POSTGRES_URL` is also supported.
3. Add a strong, private `ADMIN_TOKEN` for Production.
4. For the first deployment only, set `OLD_NETLIFY_URL` to the old site's public URL. Deploy the production branch. The build applies the idempotent database migrations and imports the old site's public spots and rating totals before building the frontend. Preview builds skip database migrations and imports.
5. After the first successful deployment, remove `OLD_NETLIFY_URL`, then test the map, submissions, ratings, and admin deletion. Keep the old site running until these checks pass.

Vercel supplies the public HTTPS URL. The deployment depends on Vercel and the selected PostgreSQL provider, but does not require Netlify or a VPS.

### Import data manually

If you prefer not to set `OLD_NETLIFY_URL`, run this once from a computer with Node.js 22 and npm. Set `DATABASE_URL` to the PostgreSQL connection string used by Vercel, then pass the old site's public URL:

```powershell
$env:DATABASE_URL = "your-private-postgres-connection-string"
npm run import:postgres -- https://your-old-site.example
```

The importer adds public locations without duplicating existing IDs and copies rating totals as snapshots. Individual old browser votes cannot be recovered through the public API, so users' personal “my rating” values start fresh. Do not send the database URL or admin token in chat or commit them to GitHub.

## Local development

Install dependencies:

```powershell
npm install
```

The existing standalone server can still be used locally with JSON storage:

```powershell
$env:ADMIN_TOKEN = "replace-this-with-a-private-token"
npm start
```

In another terminal run `npm run dev`. Vite proxies `/api` requests to the local server. The standalone JSON store is for local use; Vercel uses PostgreSQL.

## Legacy Netlify deployment

The Netlify Functions and database adapter remain in the repository temporarily so the existing Netlify site can stay available during migration. The functions select Netlify Database in Netlify and PostgreSQL when `DATABASE_URL` is used elsewhere. Do not disable the Netlify site until the Vercel deployment, imported data, submissions, ratings, and admin deletion have been verified.

## Features and notes

- Search and filter skate spots; selecting a result focuses the map.
- Each spot has English, Korean, and Chinese names and descriptions.
- Community submissions require all three names and appear publicly immediately.
- The admin page at `/?review=admin` lists locations and lets the site owner delete them using the private `ADMIN_TOKEN`.
- Anonymous ratings are keyed to a random browser ID, which is not verified identity and can be reset or spoofed.
- Public submissions and ratings do not have rate limiting or abuse controls. The admin can remove unwanted entries.
- Leaflet is bundled with the app; OpenStreetMap tiles still require an internet connection.
- `PeekRating` and `SplitText` are sourced from React Bits. See [third-party notices](./THIRD_PARTY_NOTICES.md).
