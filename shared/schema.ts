import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { sql } from "drizzle-orm";

export const projectStatusValues = [
  "registered",
  "qa_running",
  "qa_failed",
  "qa_passed",
  "deploying",
  "deployed",
  "deploy_failed",
] as const;

export type ProjectStatus = (typeof projectStatusValues)[number];

export const sourceTypeValues = ["github", "replit", "zip", "other"] as const;
export type SourceType = (typeof sourceTypeValues)[number];

export const projects = pgTable("projects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull().$type<SourceType>(),
  sourceValue: text("source_value").notNull(),
  status: text("status").notNull().default("registered").$type<ProjectStatus>(),
  qaReport: text("qa_report"),
  deployedUrl: text("deployed_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projects).pick({
  name: true,
  sourceType: true,
  sourceValue: true,
}).extend({
  name: z.string().min(1, "Project name is required").max(100, "Name too long"),
  sourceType: z.enum(sourceTypeValues),
  sourceValue: z.string().min(1, "Source URL or path is required"),
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
