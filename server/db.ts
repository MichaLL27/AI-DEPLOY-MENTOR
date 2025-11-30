import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL environment variable is missing. Database connection will fail.");
}

const connectionString = process.env.DATABASE_URL || "postgres://placeholder:placeholder@localhost:5432/placeholder";

console.log(`[DB] Initializing pool with ${process.env.DATABASE_URL ? "provided URL" : "placeholder URL"}`);

const pool = new pg.Pool({ connectionString });

// Add error handler to prevent crash on connection issues
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit process, just log
});

export const db = drizzle(pool, { schema });
