import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePostgresPool, getPool } from '../netlify/lib/db.mjs';

const rootDirectory = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const migrationDirectory = path.join(rootDirectory, 'netlify', 'database', 'migrations');

export async function migratePostgres() {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS skatespot_schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS skatespot_schema_migration_lock (
        id SMALLINT PRIMARY KEY CHECK (id = 1)
      )
    `);
    await client.query(
      'INSERT INTO skatespot_schema_migration_lock (id) VALUES (1) ON CONFLICT (id) DO NOTHING'
    );
    await client.query('SELECT id FROM skatespot_schema_migration_lock WHERE id = 1 FOR UPDATE');

    const migrationFiles = (await readdir(migrationDirectory))
      .filter(file => file.endsWith('.sql'))
      .sort();
    for (const filename of migrationFiles) {
      const alreadyApplied = await client.query(
        'SELECT 1 FROM skatespot_schema_migrations WHERE filename = $1',
        [filename]
      );
      if (alreadyApplied.rowCount) continue;

      const sql = await readFile(path.join(migrationDirectory, filename), 'utf8');
      await client.query(sql);
      await client.query(
        'INSERT INTO skatespot_schema_migrations (filename) VALUES ($1)',
        [filename]
      );
      console.log(`Applied ${filename}.`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await closePostgresPool();
  }
}

const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainModule) {
  try {
    await migratePostgres();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
