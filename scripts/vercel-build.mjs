import { build } from 'vite';
if (process.env.VERCEL_ENV === 'production') {
  const { migratePostgres } = await import('./migrate-postgres.mjs');
  await migratePostgres();

  if (process.env.OLD_NETLIFY_URL) {
    const { importNetlifyData } = await import('./import-netlify-to-postgres.mjs');
    const imported = await importNetlifyData(process.env.OLD_NETLIFY_URL);
    console.log(`Imported ${imported} new locations from the old site.`);
  }
}

await build();
