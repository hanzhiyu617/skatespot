import { Pool } from 'pg';

let postgresPool;

export async function getPool() {
  if (process.env.NETLIFY === 'true' || process.env.CONTEXT) {
    const { getDatabase } = await import('@netlify/database');
    return getDatabase().pool;
  }

  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('Set DATABASE_URL to connect to the PostgreSQL database.');
  }

  if (!postgresPool) {
    postgresPool = new Pool({
      connectionString,
      max: 1,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000
    });
  }
  return postgresPool;
}

export async function closePostgresPool() {
  if (!postgresPool) return;
  const pool = postgresPool;
  postgresPool = undefined;
  await pool.end();
}
