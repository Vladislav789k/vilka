// lib/db.ts
import { Pool, QueryResultRow } from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is not set. " +
    "For local development, create a .env.local file with: " +
    "DATABASE_URL=postgresql://kasashka:kasashka_password@localhost:5432/kasashka_db"
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Handle connection errors gracefully
pool.on("error", (err) => {
  console.error("Unexpected error on idle database client", err);
});

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: any[]
): Promise<{ rows: T[] }> {
  const client = await pool.connect();
  try {
    const res = await client.query<T>(text, params);
    return { rows: res.rows };
  } catch (error) {
    // Provide more helpful error messages
    if (error instanceof Error) {
      if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo")) {
        throw new Error(
          `Database connection failed: Cannot resolve hostname. ` +
          `Make sure Postgres is running and DATABASE_URL is correct. ` +
          `For local dev, use 'localhost' instead of 'postgres'. ` +
          `Original error: ${error.message}`
        );
      }
      if (error.message.includes("ECONNREFUSED")) {
        throw new Error(
          `Database connection refused. ` +
          `Make sure Postgres is running on the host/port specified in DATABASE_URL. ` +
          `Original error: ${error.message}`
        );
      }
    }
    throw error;
  } finally {
    client.release();
  }
}
