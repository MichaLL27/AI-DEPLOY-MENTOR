import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { insertProjectSchema } from "@shared/schema";
import { runQaOnProject } from "./services/qaService";
import { deployProject } from "./services/deployService";
import { generateAndroidWrapper } from "./services/mobileAndroidService";
import { generateIosWrapper } from "./services/mobileIosService";
import { analyzeZipProject } from "./services/zipAnalyzer";
import { classifyProject } from "./services/projectClassifier";
import { normalizeProjectStructure } from "./services/projectNormalizer";
import { autoFixProject } from "./services/autoFixService";
import { createAutoPullRequest, mergePullRequest, closePullRequest } from "./services/pullRequestService";
import { getAutoReadyMessage } from "./utils/projectState";
import { pullRequests } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import multer from "multer";
import * as fs from "fs";
import * as path from "path";

import * as os from "os";

import { cloneAndZipRepository } from "./services/githubService";

// Configure multer for ZIP uploads
// On Vercel, we must use /tmp. On local, we can use uploads/
const isVercel = process.env.VERCEL === "1";
const uploadDir = isVercel 
  ? path.join(os.tmpdir(), "uploads") 
  : path.join(process.cwd(), "uploads");

// Use memory storage on Vercel to avoid permission issues with default disk storage
const storageConfig = isVercel ? multer.memoryStorage() : multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storageConfig,
  fileFilter: (_req: any, file: any, cb: any) => {
    if (file.mimetype === "application/zip" || file.mimetype === "application/x-zip-compressed" || file.originalname.endsWith(".zip")) {
      cb(null, true);
    } else {
      cb(new Error("Only ZIP files are allowed"));
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Ensure upload directory exists (only needed for local disk storage)
  if (!isVercel) {
    try {
      fs.mkdirSync(uploadDir, { recursive: true });
    } catch (err) {
      console.error("Failed to create upload directory:", err);
    }
  }
  
  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // GET /api/projects - List all projects
  app.get("/api/projects", async (req, res) => {
    try {
      console.log("Fetching projects...");
      const projects = await storage.getAllProjects();
      console.log(`Fetched ${projects.length} projects`);
      const enriched = projects.map(p => ({
        ...p,
        autoReadyMessage: getAutoReadyMessage(p),
      }));
      res.json(enriched);
    } catch (error) {
      console.error("Error fetching projects:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: "Failed to fetch projects", details: errorMessage });
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
      
      res.json({
        ...project,
        autoReadyMessage: getAutoReadyMessage(project),
      });
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

      // Handle GitHub Import
      if (validatedData.sourceType === "github" && validatedData.sourceValue) {
        try {
          console.log(`Starting GitHub import for ${project.id} from ${validatedData.sourceValue}`);
          
          const zipPath = await cloneAndZipRepository(validatedData.sourceValue, project.id);
          
          // Update project with ZIP path
          let updatedProject = await storage.updateProject(project.id, {
            zipStoredPath: zipPath,
            zipOriginalFilename: "github-source.zip",
            zipAnalysisStatus: "pending",
          } as any);

          // Analyze the imported project
          const analysis = await analyzeZipProject(updatedProject!);
          
          updatedProject = await storage.updateProject(project.id, {
            zipAnalysisStatus: "success",
            projectType: analysis.projectType,
            projectValidity: analysis.projectValidity,
            validationErrors: JSON.stringify(analysis.validationErrors),
            normalizedStatus: analysis.normalizedStatus,
            normalizedFolderPath: analysis.normalizedFolderPath,
            normalizedReport: analysis.normalizedReport,
            readyForDeploy: analysis.readyForDeploy ? "true" : "false",
            zipAnalysisReport: analysis.analysisReport,
          } as any);

          console.log(`GitHub import successful for ${project.id}`);
          return res.status(201).json(updatedProject);

        } catch (error) {
          console.error("GitHub import failed:", error);
          
          const failedProject = await storage.updateProject(project.id, {
            zipAnalysisStatus: "failed",
            zipAnalysisReport: `GitHub import failed: ${error instanceof Error ? error.message : String(error)}`,
          } as any);
          
          return res.status(201).json(failedProject);
        }
      }

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

  // Optional Render deploy status endpoint
  app.get("/api/projects/:id/deploy-status", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      res.json({
        deployId: project.lastDeployId,
        status: project.lastDeployStatus,
        deployedUrl: project.deployedUrl,
      });
    } catch (error) {
      console.error("Error fetching deploy status:", error);
      res.status(500).json({ error: "Failed to fetch deploy status" });
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

  // POST /api/mobile-android/:projectId/generate - Generate Android wrapper
  app.post("/api/mobile-android/:projectId/generate", async (req, res) => {
    try {
      const { projectId } = req.params;
      const project = await storage.getProject(projectId);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!project.deployedUrl) {
        return res.status(400).json({ error: "Project must be deployed before generating Android wrapper" });
      }

      // Update status to building
      await storage.updateProject(projectId, { mobileAndroidStatus: "building" });

      try {
        const result = await generateAndroidWrapper(project);
        const updatedProject = await storage.updateProject(projectId, {
          mobileAndroidStatus: result.status,
          mobileAndroidDownloadUrl: result.downloadPath,
        });
        res.json(updatedProject);
      } catch (error) {
        console.error("Android generation error:", error);
        await storage.updateProject(projectId, { mobileAndroidStatus: "failed" });
        return res.status(500).json({ error: `Failed to generate Android wrapper: ${error instanceof Error ? error.message : "Unknown error"}` });
      }
    } catch (error) {
      console.error("Error in Android generation route:", error);
      res.status(500).json({ error: "Failed to generate Android wrapper" });
    }
  });

  // GET /api/mobile-android/:projectId/status - Get Android status
  app.get("/api/mobile-android/:projectId/status", async (req, res) => {
    try {
      const { projectId } = req.params;
      const project = await storage.getProject(projectId);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      res.json({
        mobileAndroidStatus: project.mobileAndroidStatus,
        mobileAndroidDownloadUrl: project.mobileAndroidDownloadUrl,
      });
    } catch (error) {
      console.error("Error fetching Android status:", error);
      res.status(500).json({ error: "Failed to fetch Android status" });
    }
  });

  // POST /api/mobile-ios/:projectId/generate - Generate iOS wrapper
  app.post("/api/mobile-ios/:projectId/generate", async (req, res) => {
    try {
      const { projectId } = req.params;
      const project = await storage.getProject(projectId);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!project.deployedUrl) {
        return res.status(400).json({ error: "Project must be deployed before generating iOS wrapper" });
      }

      // Update status to building
      await storage.updateProject(projectId, { mobileIosStatus: "building" });

      try {
        const result = await generateIosWrapper(project);
        const updatedProject = await storage.updateProject(projectId, {
          mobileIosStatus: result.status,
          mobileIosDownloadUrl: result.downloadPath,
        });
        res.json(updatedProject);
      } catch (error) {
        console.error("iOS generation error:", error);
        await storage.updateProject(projectId, { mobileIosStatus: "failed" });
        return res.status(500).json({ error: `Failed to generate iOS wrapper: ${error instanceof Error ? error.message : "Unknown error"}` });
      }
    } catch (error) {
      console.error("Error in iOS generation route:", error);
      res.status(500).json({ error: "Failed to generate iOS wrapper" });
    }
  });

  // GET /api/mobile-ios/:projectId/status - Get iOS status
  app.get("/api/mobile-ios/:projectId/status", async (req, res) => {
    try {
      const { projectId } = req.params;
      const project = await storage.getProject(projectId);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      res.json({
        mobileIosStatus: project.mobileIosStatus,
        mobileIosDownloadUrl: project.mobileIosDownloadUrl,
      });
    } catch (error) {
      console.error("Error fetching iOS status:", error);
      res.status(500).json({ error: "Failed to fetch iOS status" });
    }
  });

  // POST /api/projects/upload-zip - Upload and analyze ZIP project
  app.post("/api/projects/upload-zip", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No ZIP file provided" });
      }

      const projectName = (req.body.name as string) || req.file.originalname.replace(".zip", "");
      
      // Create organized storage path
      const projectId = require("crypto").randomUUID().substring(0, 12);
      const storedDir = isVercel 
        ? path.join(os.tmpdir(), "uploads", "projects", projectId)
        : path.join(process.cwd(), "uploads", "projects", projectId);
        
      fs.mkdirSync(storedDir, { recursive: true });

      const storedPath = path.join(storedDir, "source.zip");
      
      // Handle file saving based on storage type
      if (req.file.buffer) {
        // Memory storage (Vercel)
        fs.writeFileSync(storedPath, req.file.buffer);
      } else {
        // Disk storage (Local)
        fs.renameSync(req.file.path, storedPath);
      }

      // Create project record
      const project = await storage.createProject({
        name: projectName,
        sourceType: "zip",
        sourceValue: storedPath,
      });

      // Update with ZIP metadata
      let updatedProject = await storage.updateProject(project.id, {
        zipOriginalFilename: req.file.originalname,
        zipStoredPath: storedPath,
        zipAnalysisStatus: "pending",
      } as any);

      try {
        // Analyze ZIP
        const analysis = await analyzeZipProject(updatedProject!);
        updatedProject = await storage.updateProject(project.id, {
          zipAnalysisStatus: "success",
          projectType: analysis.projectType,
          projectValidity: analysis.projectValidity,
          validationErrors: JSON.stringify(analysis.validationErrors),
          normalizedStatus: analysis.normalizedStatus,
          normalizedFolderPath: analysis.normalizedFolderPath,
          normalizedReport: analysis.normalizedReport,
          readyForDeploy: analysis.readyForDeploy ? "true" : "false",
          zipAnalysisReport: analysis.analysisReport,
        } as any);

        console.log(`[ZIP] Analyzed project ${project.id}: ${analysis.projectType} (ready: ${analysis.readyForDeploy})`);
      } catch (error) {
        console.error(`[ZIP] Analysis failed for ${project.id}:`, error);
        updatedProject = await storage.updateProject(project.id, {
          zipAnalysisStatus: "failed",
          projectValidity: "invalid",
          normalizedStatus: "failed",
          zipAnalysisReport: `Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        } as any);
      }

      res.status(201).json(updatedProject);
    } catch (error) {
      console.error("Error uploading ZIP:", error);
      res.status(500).json({ error: "Failed to upload and analyze ZIP file" });
    }
  });

  // GET /api/projects/:id/zip-analysis - Get ZIP analysis details
  app.get("/api/projects/:id/zip-analysis", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      res.json({
        zipAnalysisStatus: project.zipAnalysisStatus,
        projectType: project.projectType,
        zipAnalysisReport: project.zipAnalysisReport,
      });
    } catch (error) {
      console.error("Error fetching ZIP analysis:", error);
      res.status(500).json({ error: "Failed to fetch ZIP analysis" });
    }
  });

  // GET /api/projects/:id/classification - Get project classification
  app.get("/api/projects/:id/classification", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      const validationErrors = project.validationErrors 
        ? JSON.parse(project.validationErrors)
        : [];

      res.json({
        projectType: project.projectType || "unknown",
        projectValidity: project.projectValidity || "warning",
        validationErrors,
      });
    } catch (error) {
      console.error("Error fetching classification:", error);
      res.status(500).json({ error: "Failed to fetch classification" });
    }
  });

  // GET /api/projects/:id/normalization - Get project normalization details
  app.get("/api/projects/:id/normalization", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      res.json({
        normalizedStatus: project.normalizedStatus || "none",
        normalizedReport: project.normalizedReport,
        readyForDeploy: project.readyForDeploy === "true",
      });
    } catch (error) {
      console.error("Error fetching normalization:", error);
      res.status(500).json({ error: "Failed to fetch normalization" });
    }
  });

  // POST /api/projects/:id/auto-fix - Run auto-fix on project
  app.post("/api/projects/:id/auto-fix", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!project.normalizedFolderPath) {
        return res.status(400).json({ error: "Project must be normalized before auto-fix" });
      }

      // Set running status
      await storage.updateProject(id, { autoFixStatus: "running" });

      try {
        const result = await autoFixProject(project);
        const updatedProject = await storage.updateProject(id, {
          autoFixStatus: result.autoFixStatus,
          autoFixReport: result.autoFixReport,
          readyForDeploy: result.readyForDeploy ? "true" : "false",
          autoFixedAt: new Date(),
        });

        console.log(`[AutoFix] Fixed project ${id}: ready=${result.readyForDeploy}`);
        res.json(updatedProject);
      } catch (error) {
        console.error(`[AutoFix] Error fixing project ${id}:`, error);
        const updatedProject = await storage.updateProject(id, {
          autoFixStatus: "failed",
          autoFixReport: `Auto-fix failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
        res.status(500).json(updatedProject);
      }
    } catch (error) {
      console.error("Error in auto-fix route:", error);
      res.status(500).json({ error: "Failed to run auto-fix" });
    }
  });

  // GET /api/projects/:id/auto-fix - Get auto-fix details
  app.get("/api/projects/:id/auto-fix", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      res.json({
        autoFixStatus: project.autoFixStatus || "none",
        autoFixReport: project.autoFixReport,
        autoFixedAt: project.autoFixedAt,
        readyForDeploy: project.readyForDeploy === "true",
      });
    } catch (error) {
      console.error("Error fetching auto-fix status:", error);
      res.status(500).json({ error: "Failed to fetch auto-fix status" });
    }
  });

  // GET /api/projects/:projectId/prs - List pull requests
  app.get("/api/projects/:projectId/prs", async (req, res) => {
    try {
      const { projectId } = req.params;
      const prs = await db
        .select()
        .from(pullRequests)
        .where(eq(pullRequests.projectId, projectId));

      res.json(prs);
    } catch (error) {
      console.error("Error fetching PRs:", error);
      res.status(500).json({ error: "Failed to fetch pull requests" });
    }
  });

  // GET /api/prs/:prId - Get PR details
  app.get("/api/prs/:prId", async (req, res) => {
    try {
      const { prId } = req.params;
      const pr = await db
        .select()
        .from(pullRequests)
        .where(eq(pullRequests.id, prId))
        .then(rows => rows[0]);

      if (!pr) {
        return res.status(404).json({ error: "PR not found" });
      }

      res.json(pr);
    } catch (error) {
      console.error("Error fetching PR:", error);
      res.status(500).json({ error: "Failed to fetch pull request" });
    }
  });

  // POST /api/prs/:prId/merge - Merge PR
  app.post("/api/prs/:prId/merge", async (req, res) => {
    try {
      const { prId } = req.params;
      const pr = await db
        .select()
        .from(pullRequests)
        .where(eq(pullRequests.id, prId))
        .then(rows => rows[0]);

      if (!pr) {
        return res.status(404).json({ error: "PR not found" });
      }

      const project = await storage.getProject(pr.projectId);
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      try {
        await mergePullRequest(pr as any, project.normalizedFolderPath || "");
        
        // Update PR status in DB
        const updatedPr = await db
          .update(pullRequests)
          .set({ status: "merged" } as any)
          .where(eq(pullRequests.id, prId))
          .returning()
          .then(rows => rows[0]);

        res.json(updatedPr);
      } catch (error) {
        console.error("Error merging PR:", error);
        res.status(500).json({ error: "Failed to merge PR" });
      }
    } catch (error) {
      console.error("Error in merge route:", error);
      res.status(500).json({ error: "Failed to merge pull request" });
    }
  });

  // POST /api/prs/:prId/close - Close PR
  app.post("/api/prs/:prId/close", async (req, res) => {
    try {
      const { prId } = req.params;
      const updatedPr = await db
        .update(pullRequests)
        .set({ status: "closed" } as any)
        .where(eq(pullRequests.id, prId))
        .returning()
        .then(rows => rows[0]);

      res.json(updatedPr);
    } catch (error) {
      console.error("Error closing PR:", error);
      res.status(500).json({ error: "Failed to close pull request" });
    }
  });

  return httpServer;
}
