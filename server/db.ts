import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL environment variable is missing. Database connection will fail.");
}

// Use a dummy connection string if missing to prevent crash on startup
// This will cause queries to fail, which we can catch
const connectionString = process.env.DATABASE_URL || "postgres://placeholder:placeholder@localhost:5432/placeholder";

const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });
