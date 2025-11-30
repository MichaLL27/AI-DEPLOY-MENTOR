import { type Project, type InsertProject, projects } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getAllProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getAllProjects(): Promise<Project[]> {
    return await db
      .select()
      .from(projects)
      .orderBy(desc(projects.createdAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const result = await db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    return result[0];
  }

  async createProject(insertProject: InsertProject): Promise<Project> {
    const result = await db
      .insert(projects)
      .values({
        name: insertProject.name,
        sourceType: insertProject.sourceType,
        sourceValue: insertProject.sourceValue,
        renderServiceId: insertProject.renderServiceId ?? null,
        renderDashboardUrl: insertProject.renderDashboardUrl ?? null,
        status: "registered",
      })
      .returning();
    return result[0];
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project | undefined> {
    const { updatedAt, ...safeUpdates } = updates;
    const result = await db
      .update(projects)
      .set({
        ...safeUpdates,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();
    return result[0];
  }

  async deleteProject(id: string): Promise<boolean> {
    const result = await db
      .delete(projects)
      .where(eq(projects.id, id))
      .returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();
