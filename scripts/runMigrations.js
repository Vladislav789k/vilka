const fs = require("fs/promises");
const path = require("path");
const { Client } = require("pg");

const MIGRATIONS_DIR = path.join(process.cwd(), "db", "migrations");
const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDatabaseReady() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const client = new Client({ connectionString });
    try {
      await client.connect();
      await client.query("SELECT 1");
      await client.end();
      return;
    } catch (error) {
      lastError = error;
      try {
        await client.end();
      } catch {}

      console.log(`[migrations] Postgres not ready yet (${attempt}/${MAX_RETRIES})`);
      await sleep(RETRY_DELAY_MS);
    }
  }

  throw lastError ?? new Error("Postgres is not ready");
}

async function listMigrationFiles() {
  const entries = await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function getAppliedMigrations(client) {
  const { rows } = await client.query("SELECT filename FROM public.schema_migrations");
  return new Set(rows.map((row) => row.filename));
}

async function applyMigration(client, filename) {
  const fullPath = path.join(MIGRATIONS_DIR, filename);
  const sql = await fs.readFile(fullPath, "utf8");

  console.log(`[migrations] applying ${filename}`);
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO public.schema_migrations (filename) VALUES ($1)", [filename]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function main() {
  await ensureDatabaseReady();

  const connectionString = process.env.DATABASE_URL;
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);
    const files = await listMigrationFiles();

    for (const filename of files) {
      if (applied.has(filename)) {
        continue;
      }
      await applyMigration(client, filename);
    }

    console.log("[migrations] done");
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[migrations] failed", error);
  process.exit(1);
});
