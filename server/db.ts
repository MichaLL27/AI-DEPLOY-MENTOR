import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL environment variable is missing. Database connection will fail.");
}

const rawConnectionString = process.env.DATABASE_URL || "postgres://placeholder:placeholder@localhost:5432/placeholder";

// Remove sslmode=require if present, as neon-http uses HTTPS automatically
const connectionString = rawConnectionString.replace("?sslmode=require", "");

console.log(`[DB] Initializing neon-http client with ${process.env.DATABASE_URL ? "provided URL" : "placeholder URL"}`);

const sql = neon(connectionString);
export const db = drizzle(sql, { schema });
