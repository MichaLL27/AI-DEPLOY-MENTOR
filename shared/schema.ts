import { z } from "zod";

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

export interface Project {
  id: string;
  name: string;
  sourceType: SourceType;
  sourceValue: string;
  status: ProjectStatus;
  qaReport: string | null;
  deployedUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export const insertProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100, "Name too long"),
  sourceType: z.enum(sourceTypeValues),
  sourceValue: z.string().min(1, "Source URL or path is required"),
});

export type InsertProject = z.infer<typeof insertProjectSchema>;

export const users = {} as any;
export const insertUserSchema = z.object({
  username: z.string(),
  password: z.string(),
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = { id: string; username: string; password: string };
