# skatespot

A Korean skate-spot directory with a Leaflet/OpenStreetMap map, three-language spot names and descriptions, direct community submissions, ratings, and admin deletion. The frontend is a Vite site; the API runs as Netlify Functions and stores data in Netlify Database (PostgreSQL).

## Requirements

- Node.js 22.13 or newer
- npm

## Local development

```powershell
npm install
$env:ADMIN_TOKEN = "set-a-private-local-token"
npm run dev
```

Open the local URL printed by Vite. The `@netlify/vite-plugin` serves the functions and local database alongside the frontend. The first run may require Netlify's local database runtime. Apply database migrations with:

```powershell
npm run db:migrate
```

To manage or delete locations locally, open `/?review=admin` and enter the `ADMIN_TOKEN` set in the same terminal. Do not commit the token.

Leaflet is bundled with the app; OpenStreetMap tiles still require an internet connection.

## Deploy to Netlify

1. Push this project to a GitHub repository and import it in Netlify.
2. Keep the build settings from `netlify.toml` (`npm run build`, publish `dist`).
3. Netlify Database provisions the database and applies migrations in `netlify/database/migrations/`, including the six sample locations and publishing any earlier pending submissions.
4. In the Netlify site environment variables, set a private `ADMIN_TOKEN`, then deploy.

The public site URL will be shown in the Netlify dashboard after deployment. View API function logs in the site's **Functions** section. Inspect or query the PostgreSQL data from **Data & Storage → Database**, or run `npm run db:connect` after linking the local Netlify CLI to the site.

Netlify Database consumes plan credits. No site, database, or deployment is created by this code change; review Netlify's current pricing and confirm in your Netlify account before enabling it. Existing local JSON files in `data/` are not automatically copied to the hosted database.

## Features

- Search and filter skate spots; selecting a result focuses the map.
- Each spot has English, Korean, and Chinese names and descriptions.
- Community submissions require all three names and appear publicly immediately.
- The admin page at `/?review=admin` lists locations and lets the site owner delete them using the private `ADMIN_TOKEN`.
- Anonymous ratings are keyed to a random browser ID, which is not verified identity and can be reset or spoofed. Public submissions and ratings do not yet have rate limiting or abuse controls.
- Because submissions publish immediately and are not rate limited, share the site only if you are comfortable with public posts; the admin can remove unwanted entries.
- `PeekRating` and `SplitText` are sourced from React Bits. See [third-party notices](./THIRD_PARTY_NOTICES.md).
