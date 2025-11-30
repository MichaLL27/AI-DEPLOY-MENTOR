import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertProjectSchema } from "@shared/schema";
import { runQaOnProject } from "./services/qaService";
import { deployProject } from "./services/deployService";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // GET /api/projects - List all projects
  app.get("/api/projects", async (req, res) => {
    try {
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // GET /api/projects/:id - Get single project
  app.get("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      res.json(project);
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ error: "Failed to fetch project" });
    }
  });

  // POST /api/projects - Create new project
  app.post("/api/projects", async (req, res) => {
    try {
      const validatedData = insertProjectSchema.parse(req.body);
      const project = await storage.createProject(validatedData);
      res.status(201).json(project);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ error: validationError.message });
      }
      console.error("Error creating project:", error);
      res.status(500).json({ error: "Failed to create project" });
    }
  });

  // POST /api/projects/:id/run-qa - Run QA on project
  app.post("/api/projects/:id/run-qa", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Only allow QA on registered or failed projects
      if (!["registered", "qa_failed"].includes(project.status)) {
        return res.status(400).json({ 
          error: `Cannot run QA on project with status: ${project.status}` 
        });
      }

      // Update status to qa_running
      await storage.updateProject(id, { status: "qa_running" });

      // Run QA checks
      const qaResult = await runQaOnProject(project);

      // Update project with results
      const updatedProject = await storage.updateProject(id, {
        status: qaResult.passed ? "qa_passed" : "qa_failed",
        qaReport: qaResult.report,
      });

      res.json(updatedProject);
    } catch (error) {
      console.error("Error running QA:", error);
      // Try to update status to failed
      try {
        await storage.updateProject(req.params.id, { status: "qa_failed" });
      } catch {}
      res.status(500).json({ error: "Failed to run QA checks" });
    }
  });

  // POST /api/projects/:id/deploy - Deploy project
  app.post("/api/projects/:id/deploy", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Only allow deployment on qa_passed projects
      if (project.status !== "qa_passed") {
        return res.status(400).json({ 
          error: "Project must pass QA before deployment" 
        });
      }

      // Update status to deploying
      await storage.updateProject(id, { status: "deploying" });

      // Deploy the project
      const deployResult = await deployProject(project);

      if (!deployResult.success) {
        await storage.updateProject(id, { status: "deploy_failed" });
        return res.status(500).json({ error: deployResult.error });
      }

      // Update project with deployment URL
      const updatedProject = await storage.updateProject(id, {
        status: "deployed",
        deployedUrl: deployResult.deployedUrl,
      });

      res.json(updatedProject);
    } catch (error) {
      console.error("Error deploying project:", error);
      // Try to update status to failed
      try {
        await storage.updateProject(req.params.id, { status: "deploy_failed" });
      } catch {}
      res.status(500).json({ error: "Failed to deploy project" });
    }
  });

  // DELETE /api/projects/:id - Delete project
  app.delete("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteProject(id);
      
      if (!deleted) {
        return res.status(404).json({ error: "Project not found" });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting project:", error);
      res.status(500).json({ error: "Failed to delete project" });
    }
  });

  return httpServer;
}
