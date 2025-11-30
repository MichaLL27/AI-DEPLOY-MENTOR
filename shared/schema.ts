import { pgTable, text, varchar, timestamp, integer, json } from "drizzle-orm/pg-core";
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
  renderServiceId: text("render_service_id"),
  renderDashboardUrl: text("render_dashboard_url"),
  lastDeployId: text("last_deploy_id"),
  lastDeployStatus: text("last_deploy_status"),
  deployLogs: text("deploy_logs"),
  mobileAndroidStatus: text("mobile_android_status").default("none"),
  mobileAndroidDownloadUrl: text("mobile_android_download_url"),
  mobileIosStatus: text("mobile_ios_status").default("none"),
  mobileIosDownloadUrl: text("mobile_ios_download_url"),
  zipOriginalFilename: text("zip_original_filename"),
  zipStoredPath: text("zip_stored_path"),
  zipAnalysisStatus: text("zip_analysis_status").default("none"),
  zipAnalysisReport: text("zip_analysis_report"),
  projectType: text("project_type").default("unknown"),
  projectValidity: text("project_validity").default("warning"),
  validationErrors: text("validation_errors"),
  normalizedStatus: text("normalized_status").default("none"),
  normalizedFolderPath: text("normalized_folder_path"),
  normalizedReport: text("normalized_report"),
  readyForDeploy: text("ready_for_deploy").default("false"),
  autoFixStatus: text("auto_fix_status").default("none"),
  autoFixReport: text("auto_fix_report"),
  autoFixedAt: timestamp("auto_fixed_at"),
  envVars: json("env_vars").default({}),
  lastPrNumber: integer("last_pr_number").default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const pullRequests = pgTable("pull_requests", {
  id: varchar("id").primaryKey(),
  projectId: varchar("project_id").notNull(),
  prNumber: integer("pr_number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"),
  diffJson: json("diff_json").default([]),
  patchFolderPath: text("patch_folder_path"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export interface FileDiff {
  file: string;
  change: "added" | "removed" | "modified";
  before?: string;
  after?: string;
}

export type PullRequest = typeof pullRequests.$inferSelect;

export const insertProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100, "Name too long"),
  sourceType: z.enum(sourceTypeValues),
  sourceValue: z.string().min(1, "Source URL or path is required"),
  renderServiceId: z.string().optional().nullable(),
  renderDashboardUrl: z.string().optional().nullable(),
});

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;
