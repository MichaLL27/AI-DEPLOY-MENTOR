import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL environment variable is missing. Database connection will fail.");
}

const connectionString = process.env.DATABASE_URL || "postgres://placeholder:placeholder@localhost:5432/placeholder";

console.log(`[DB] Initializing pg client with ${process.env.DATABASE_URL ? "provided URL" : "placeholder URL"}`);

const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
