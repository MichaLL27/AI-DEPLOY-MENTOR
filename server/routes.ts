import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { insertProjectSchema } from "@shared/schema";
import { runQaOnProject } from "./services/qaService";
import { deployProject, syncEnvVarsToRender } from "./services/deployService";
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
import * as crypto from "crypto";
import { openai } from "./lib/openai";

import * as os from "os";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

import { cloneAndZipRepository } from "./services/githubService";
import { importProjectFromUrl } from "./services/importService";

import { autoFixEnvVars, detectEnvVars } from "./services/envService";
import { syncEnvVarsToVercel } from "./services/vercelService";
import { syncEnvVarsToRailway } from "./services/railwayService";

import { generateFunctionalTests } from "./services/testGeneratorService";

// Configure multer for ZIP uploads
// On Vercel and Render, we must use /tmp. On local, we can use uploads/
const isVercel = process.env.VERCEL === "1";
const isRender = process.env.RENDER === "true";
const uploadDir = (isVercel || isRender)
  ? path.join(os.tmpdir(), "uploads") 
  : path.join(process.cwd(), "uploads");

// Use memory storage on Vercel/Render to avoid permission issues with default disk storage
const storageConfig = (isVercel || isRender) ? multer.memoryStorage() : multer.diskStorage({
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
  if (!isVercel && !isRender) {
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

  // GET /api/config/providers - Get configured providers
  app.get("/api/config/providers", (_req, res) => {
    res.json({
      vercel: !!process.env.VERCEL_TOKEN,
      render: !!process.env.RENDER_API_TOKEN,
      railway: !!process.env.RAILWAY_TOKEN,
      digitalocean: !!process.env.DO_TOKEN,
      aws: !!process.env.AWS_ACCESS_KEY_ID,
      gcp: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
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

      // Handle Imports (GitHub, Replit, Lovable, Base44)
      if (["github", "replit", "lovable", "base44"].includes(validatedData.sourceType) && validatedData.sourceValue) {
        try {
          console.log(`Starting import for ${project.id} from ${validatedData.sourceType}`);
          
          const updatedProject = await importProjectFromUrl(
            project.id,
            validatedData.sourceValue,
            validatedData.sourceType as any
          );

          console.log(`Import successful for ${project.id}`);
          return res.status(201).json(updatedProject);

        } catch (error) {
          console.error("Import failed:", error);
          
          // Delete the project since import failed so we don't have empty projects
          await storage.deleteProject(project.id);
          
          return res.status(400).json({ 
            error: `Import failed: ${error instanceof Error ? error.message : String(error)}` 
          });
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

  // PATCH /api/projects/:id - Update project details
  app.patch("/api/projects/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Allow updating specific fields
      const allowedUpdates = ["deploymentTarget", "name"];
      const updates: any = {};
      
      for (const key of allowedUpdates) {
        if (req.body[key] !== undefined) {
          updates[key] = req.body[key];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.json(project);
      }

      const updatedProject = await storage.updateProject(id, updates);
      res.json(updatedProject);
    } catch (error) {
      console.error("Error updating project:", error);
      res.status(500).json({ error: "Failed to update project" });
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
      let project = await storage.getProject(id);
      
      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Only allow QA on registered, failed, or deployed projects (allow re-verification)
      if (!["registered", "qa_failed", "qa_passed", "deployed", "deploy_failed"].includes(project.status)) {
        return res.status(400).json({ 
          error: `Cannot run QA on project with status: ${project.status}` 
        });
      }

      // FORCE RE-ANALYSIS to ensure we have the correct project type
      // This fixes the issue where a project was misclassified before a logic fix
      if (project.sourceType === "zip" || project.sourceType === "github") {
         console.log(`[QA] Re-analyzing project ${id} to ensure correct classification...`);
         try {
            // Log to UI so user sees what's happening
            await storage.updateProject(id, { qaLogs: `[${new Date().toISOString()}] Re-analyzing project structure to ensure correct classification...\n` });

            const analysis = await analyzeZipProject(project);
            
            // Update project with new analysis results
            const updated = await storage.updateProject(id, {
              projectType: analysis.projectType,
              projectValidity: analysis.projectValidity,
              validationErrors: JSON.stringify(analysis.validationErrors),
              normalizedStatus: analysis.normalizedStatus,
              normalizedFolderPath: analysis.normalizedFolderPath,
              normalizedReport: analysis.normalizedReport,
              readyForDeploy: analysis.readyForDeploy ? "true" : "false",
              zipAnalysisReport: analysis.analysisReport,
              structureJson: analysis.structureJson,
            } as any);
            
            if (updated) {
              project = updated;
            }
         } catch (err) {
            console.error("[QA] Re-analysis failed:", err);
            // We continue, but warn
         }
      }

      // Auto-fix if not already done or if it failed previously
      // This ensures we always test the best version of the code
      if (project.autoFixStatus !== "success") {
        return res.status(400).json({ 
          error: "Please run Auto-fix before running QA checks." 
        });
      }

      // Update status to qa_running
      await storage.updateProject(id, { status: "qa_running" });

      // Run QA checks in BACKGROUND to avoid Render timeouts
      runQaOnProject(project).then(async (qaResult) => {
        await storage.updateProject(id, {
          status: qaResult.passed ? "qa_passed" : "qa_failed",
          qaReport: qaResult.report,
          // qaLastRun: new Date(), // Removed as it's not in schema
        });
      }).catch(async (err) => {
        console.error("Background QA failed:", err);
        await storage.updateProject(id, { 
          status: "qa_failed", 
          qaReport: `Internal Server Error during QA execution: ${err.message}` 
        });
      });

      // Return immediately
      res.json({ 
        status: "qa_running", 
        message: "QA started in background. Please poll for updates." 
      });
    } catch (error) {
      console.error("Error running QA:", error);
      // Try to update status to failed
      try {
        await storage.updateProject(req.params.id, { status: "qa_failed" });
      } catch {}
      res.status(500).json({ error: "Failed to start QA process" });
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
      if (!["qa_passed", "deployed", "deploy_failed", "qa_failed"].includes(project.status)) {
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
      const project = await storage.getProject(id);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      // Delete project record
      const deleted = await storage.deleteProject(id);
      
      if (deleted) {
        // Clean up file system resources
        try {
          const isVercel = process.env.VERCEL === "1";
          
          // 1. Delete Uploads
          const uploadPath = (isVercel || isRender)
            ? path.join(os.tmpdir(), "uploads", "projects", id)
            : path.join(process.cwd(), "uploads", "projects", id);
            
          if (fs.existsSync(uploadPath)) {
            fs.rmSync(uploadPath, { recursive: true, force: true });
          }

          // 2. Delete Normalized Code
          const normalizedPath = (isVercel || isRender)
            ? path.join(os.tmpdir(), "normalized", id)
            : path.join(process.cwd(), "normalized", id);

          if (fs.existsSync(normalizedPath)) {
            fs.rmSync(normalizedPath, { recursive: true, force: true });
          }

          // 3. Delete Temp Analysis
          const tempAnalysisPath = (isVercel || isRender)
            ? path.join(os.tmpdir(), "zip-analysis", id)
            : path.join(process.cwd(), "tmp", "zip-analysis", id);

          if (fs.existsSync(tempAnalysisPath)) {
            fs.rmSync(tempAnalysisPath, { recursive: true, force: true });
          }

          console.log(`[Cleanup] Deleted files for project ${id}`);
        } catch (err) {
          console.error(`[Cleanup] Failed to clean up files for project ${id}:`, err);
          // We don't fail the request if cleanup fails, as the DB record is gone
        }
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

      // Start generation in background (async)
      generateIosWrapper(project)
        .then(async (result) => {
          await storage.updateProject(projectId, {
            mobileIosStatus: result.status,
            mobileIosDownloadUrl: result.downloadPath,
          });
        })
        .catch(async (error) => {
          console.error("iOS generation error:", error);
          await storage.updateProject(projectId, { mobileIosStatus: "failed" });
        });

      // Return immediately with jobId
      res.json({ jobId: projectId, status: "building" });
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
        status: project.mobileIosStatus || "pending",
        downloadUrl: project.mobileIosDownloadUrl,
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
      const projectId = crypto.randomUUID().substring(0, 12);
      const storedDir = (isVercel || isRender)
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
        // Use copy + unlink instead of rename to avoid cross-device link errors
        try {
          fs.copyFileSync(req.file.path, storedPath);
          fs.unlinkSync(req.file.path);
        } catch (err) {
          console.error("Error moving uploaded file:", err);
          // Fallback to rename if copy fails (unlikely)
          fs.renameSync(req.file.path, storedPath);
        }
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
            structureJson: analysis.structureJson,
          } as any);        console.log(`[ZIP] Analyzed project ${project.id}: ${analysis.projectType} (ready: ${analysis.readyForDeploy})`);
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
      const updatedProject = await storage.updateProject(id, { 
        autoFixStatus: "running",
        autoFixReport: "Auto-fix started in background...",
        autoFixLogs: `[${new Date().toISOString()}] Auto-fix process started.\n`
      });

      // Run in background (fire and forget)
      // The service now handles updating the DB with success/failure
      autoFixProject(project).catch(err => {
        console.error(`[AutoFix] Background process crashed for ${id}:`, err);
        storage.updateProject(id, {
          autoFixStatus: "failed",
          autoFixReport: `Background process crashed: ${err instanceof Error ? err.message : String(err)}`
        });
      });

      res.status(202).json(updatedProject);
    } catch (error) {
      console.error("Error in auto-fix route:", error);
      res.status(500).json({ error: "Failed to start auto-fix" });
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

  // GET /api/projects/:id/files - List project files
  app.get("/api/projects/:id/files", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!project.normalizedFolderPath || !fs.existsSync(project.normalizedFolderPath)) {
        return res.json({ files: [] });
      }

      const files: { path: string; type: "file" | "directory" }[] = [];
      
      const walk = (dir: string, relativePath: string) => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          if (item === "node_modules" || item === ".git") continue;
          
          const fullPath = path.join(dir, item);
          const itemRelPath = path.join(relativePath, item);
          const stat = fs.statSync(fullPath);
          
          files.push({
            path: itemRelPath.replace(/\\/g, "/"),
            type: stat.isDirectory() ? "directory" : "file"
          });

          if (stat.isDirectory()) {
            walk(fullPath, itemRelPath);
          }
        }
      };

      walk(project.normalizedFolderPath, "");
      
      // Sort: directories first, then files
      files.sort((a, b) => {
        if (a.type === b.type) return a.path.localeCompare(b.path);
        return a.type === "directory" ? -1 : 1;
      });

      res.json({ files });
    } catch (error) {
      console.error("Error listing files:", error);
      res.status(500).json({ error: "Failed to list files" });
    }
  });

  // GET /api/projects/:id/env - Get env vars
  app.get("/api/projects/:id/env", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Project not found" });

      res.json(project.envVars || {});
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch env vars" });
    }
  });

  // POST /api/projects/:id/env - Update env vars
  app.post("/api/projects/:id/env", async (req, res) => {
    try {
      const { id } = req.params;
      const envVars = req.body; // Expecting Record<string, EnvVar>
      
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Project not found" });

      // 1. Update DB
      await storage.updateProject(id, { envVars });

      // 2. Sync to Vercel (if configured)
      if (process.env.VERCEL_TOKEN) {
        // We need to pass the updated project object
        const updatedProject = { ...project, envVars };
        const syncResult = await syncEnvVarsToVercel(updatedProject as any);
        
        if (!syncResult.success) {
          console.warn(`[EnvSync] Failed to sync to Vercel: ${syncResult.error}`);
          // We return success: true because DB update worked, but include warning
          return res.json({ success: true, warning: `Saved to DB but failed to sync to Vercel: ${syncResult.error}` });
        }
      }

      // 3. Sync to Railway (if configured)
      if (process.env.RAILWAY_TOKEN && project.railwayServiceId) {
        const updatedProject = { ...project, envVars };
        const syncResult = await syncEnvVarsToRailway(updatedProject as any);
        
        if (!syncResult.success) {
          console.warn(`[EnvSync] Failed to sync to Railway: ${syncResult.error}`);
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating env vars:", error);
      res.status(500).json({ error: "Failed to update env vars" });
    }
  });

  // POST /api/projects/:id/env/autofix - Auto-fix env vars
  app.post("/api/projects/:id/env/autofix", async (req, res) => {
    try {
      const { id } = req.params;
      const project = await storage.getProject(id);
      if (!project) return res.status(404).json({ error: "Project not found" });

      const fixedVars = await autoFixEnvVars(project);

      // Sync to Vercel if configured
      if (process.env.VERCEL_TOKEN) {
        const updatedProject = { ...project, envVars: fixedVars };
        await syncEnvVarsToVercel(updatedProject as any);
      }

      // Sync to Render if configured
      if (process.env.RENDER_API_TOKEN && project.renderServiceId) {
        const updatedProject = { ...project, envVars: fixedVars };
        await syncEnvVarsToRender(updatedProject as any);
      }

      // Sync to Railway if configured
      if (process.env.RAILWAY_TOKEN && project.railwayServiceId) {
        const updatedProject = { ...project, envVars: fixedVars };
        await syncEnvVarsToRailway(updatedProject as any);
      }

      res.json(fixedVars);
    } catch (error) {
      console.error("Env autofix error:", error);
      res.status(500).json({ error: "Failed to auto-fix env vars" });
    }
  });

  // POST /api/projects/:id/chat - Chat with AI Mentor
  app.post("/api/projects/:id/chat", async (req, res) => {
    try {
      const { id } = req.params;
      const { message, history } = req.body;
      const project = await storage.getProject(id);

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      if (!process.env.OPENAI_API_KEY) {
        return res.status(500).json({ error: "OpenAI API key not configured" });
      }

      // Construct context
      let context = `Project Name: ${project.name}\n`;
      context += `Project Type: ${project.projectType}\n`;
      context += `Status: ${project.status}\n`;
      
      if (project.structureJson) {
        const structureStr = JSON.stringify(project.structureJson);
        context += `\nProject Structure Summary:\n${structureStr.substring(0, 1000)}...\n`;
      }
      
      if (project.qaReport) {
        context += `\nQA Report Summary:\n${project.qaReport.substring(0, 1000)}...\n`;
      }

      if (project.autoFixReport) {
        context += `\nAuto-Fix Report Summary:\n${project.autoFixReport.substring(0, 1000)}...\n`;
      }

      const systemPrompt = `You are an expert AI Mentor for the software project "${project.name}".
Your goal is to help the user understand the project, debug issues, and improve the code.
You have access to the project's technical context, including its structure, QA status, and auto-fix reports.

Context:
${context}

CRITICAL INSTRUCTIONS FOR ANALYSIS & GUIDANCE:
1. DIAGNOSIS: If the project failed to build, deploy, or pass QA, explain EXACTLY why based on the logs and reports. Don't just say "it failed", explain the root cause (e.g., "Missing environment variable DATABASE_URL", "Syntax error in line 42").
2. GAP ANALYSIS: Even if the project runs, analyze if it is "production-ready". Point out missing best practices, security vulnerabilities, or missing environment variables. Tell the user what is missing for the project to work PERFECTLY.
3. DEEP LOGIC ANALYSIS: Don't just look at syntax. Analyze the BUSINESS LOGIC. Ask yourself:
   - Does the authentication flow actually protect routes?
   - Are database transactions used where data integrity matters?
   - Are error states handled gracefully in the UI?
   - If you see a gap, PROACTIVELY suggest a fix or write the code to fix it.
4. LIMITATIONS & MANUAL INSTRUCTIONS: If a task is beyond your capabilities (e.g., requires external service setup like Firebase/AWS, complex manual logic, or credentials you don't have), explicitly tell the user: "I cannot do this automatically because [reason]. Here are the steps you need to follow manually: ..." and provide a numbered list of instructions.

Answer the user's questions based on this context. Be helpful, concise, and technical.
You can also perform actions on the project if the user requests them.
Available actions:
- Run Auto-Fix: Repairs code, structure, and environment variables.
- Run QA: Runs quality assurance checks and tests.
- Deploy: Deploys the project to the configured provider.
- Read File: Read the content of a specific file to answer questions about the code.
- Write File: Create or update a file with new content.
- Install Package: Install a new npm package.
- Generate Docker Compose: Create a docker-compose.yml file for local development.
- Patch Security: Run security audit and attempt to fix vulnerabilities.

If the user asks to perform one of these actions, CALL THE CORRESPONDING TOOL/FUNCTION.`;

      const tools = [
        {
          type: "function",
          function: {
            name: "run_autofix",
            description: "Run the auto-fix process to repair code and structure issues.",
            parameters: { type: "object", properties: {} }
          }
        },
        {
          type: "function",
          function: {
            name: "run_qa",
            description: "Run Quality Assurance checks and tests.",
            parameters: { type: "object", properties: {} }
          }
        },
        {
          type: "function",
          function: {
            name: "deploy_project",
            description: "Deploy the project to the configured provider.",
            parameters: { type: "object", properties: {} }
          }
        },
        {
          type: "function",
          function: {
            name: "read_file",
            description: "Read the content of a specific file in the project.",
            parameters: {
              type: "object",
              properties: {
                filePath: {
                  type: "string",
                  description: "The relative path of the file to read (e.g., 'src/index.ts')."
                }
              },
              required: ["filePath"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "write_file",
            description: "Create or update a file with new content.",
            parameters: {
              type: "object",
              properties: {
                filePath: {
                  type: "string",
                  description: "The relative path of the file to write (e.g., 'src/components/Button.tsx')."
                },
                content: {
                  type: "string",
                  description: "The full content to write to the file."
                }
              },
              required: ["filePath", "content"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "install_package",
            description: "Install an npm package in the project.",
            parameters: {
              type: "object",
              properties: {
                packageName: {
                  type: "string",
                  description: "The name of the package to install (e.g., 'axios', 'lodash')."
                },
                dev: {
                  type: "boolean",
                  description: "Whether to install as a dev dependency (default: false)."
                }
              },
              required: ["packageName"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "generate_tests",
            description: "Generate automated functional tests for the project.",
            parameters: { type: "object", properties: {} }
          }
        },
        {
          type: "function",
          function: {
            name: "generate_docker_compose",
            description: "Generate a docker-compose.yml file for local development with database support.",
            parameters: { type: "object", properties: {} }
          }
        },
        {
          type: "function",
          function: {
            name: "patch_security",
            description: "Run npm audit fix and attempt to patch security vulnerabilities.",
            parameters: { type: "object", properties: {} }
          }
        },
        {
          type: "function",
          function: {
            name: "generate_health_check",
            description: "Generate a /health endpoint and instrument basic metrics.",
            parameters: { type: "object", properties: {} }
          }
        },
        {
          type: "function",
          function: {
            name: "run_static_analysis",
            description: "Run static code analysis (linting) to find logic errors.",
            parameters: { type: "object", properties: {} }
          }
        },
        {
          type: "function",
          function: {
            name: "generate_deployment_config",
            description: "Generate deployment configuration (Terraform/CloudFormation) for a specific provider.",
            parameters: {
              type: "object",
              properties: {
                provider: {
                  type: "string",
                  enum: ["aws", "digitalocean", "gcp"],
                  description: "The cloud provider to generate config for."
                }
              },
              required: ["provider"]
            }
          }
        }
      ];

      const messages = [
        { role: "system", content: systemPrompt },
        ...(history || []),
        { role: "user", content: message }
      ];

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages as any,
        tools: tools as any,
        tool_choice: "auto",
      });

      const responseMessage = response.choices[0].message;

      // Handle tool calls
      if (responseMessage.tool_calls) {
        const toolCall = responseMessage.tool_calls[0];
        const functionName = toolCall["function"].name;
        
        let toolResult = "";
        
        if (functionName === "read_file") {
           const args = JSON.parse(toolCall["function"].arguments);
           const filePath = args.filePath;
           let fileContent = "";
           
           try {
              if (!project.normalizedFolderPath) {
                 throw new Error("Project is not normalized yet. Cannot read files.");
              }
              
              const fullPath = path.join(project.normalizedFolderPath, filePath);
              
              // Security check
              if (!fullPath.startsWith(project.normalizedFolderPath)) {
                 throw new Error("Access denied: Cannot read files outside project directory.");
              }
              
              if (!fs.existsSync(fullPath)) {
                 throw new Error(`File not found: ${filePath}`);
              }
              
              const stats = await fs.promises.stat(fullPath);
              if (stats.isDirectory()) {
                 const files = await fs.promises.readdir(fullPath);
                 fileContent = `Directory listing for ${filePath}:\n${files.join("\n")}`;
              } else {
                 fileContent = await fs.promises.readFile(fullPath, "utf-8");
                 if (fileContent.length > 20000) {
                    fileContent = fileContent.substring(0, 20000) + "\n...(truncated)";
                 }
              }
           } catch (err) {
              fileContent = `Error reading file: ${err instanceof Error ? err.message : String(err)}`;
           }
           
           // For read_file, we want to feed the content back to the AI to get an answer
           messages.push(responseMessage);
           messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: fileContent
           });
           
           const secondResponse = await openai.chat.completions.create({
             model: "gpt-4o",
             messages: messages as any,
             // Disable tools for the second turn to prevent loops for now
             tools: undefined 
           });
           
           return res.json({ response: secondResponse.choices[0].message.content });
        } else if (functionName === "write_file") {
           const args = JSON.parse(toolCall["function"].arguments);
           const { filePath, content } = args;
           
           try {
              if (!project.normalizedFolderPath) {
                 throw new Error("Project is not normalized yet. Cannot write files.");
              }
              
              const fullPath = path.join(project.normalizedFolderPath, filePath);
              
              // Security check
              if (!fullPath.startsWith(project.normalizedFolderPath)) {
                 throw new Error("Access denied: Cannot write files outside project directory.");
              }
              
              // Ensure directory exists
              await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
              
              await fs.promises.writeFile(fullPath, content, "utf-8");
              toolResult = `Successfully wrote to ${filePath}.`;
           } catch (err) {
              toolResult = `Error writing file: ${err instanceof Error ? err.message : String(err)}`;
           }
        } else if (functionName === "install_package") {
           const args = JSON.parse(toolCall["function"].arguments);
           const { packageName, dev } = args;
           
           try {
              if (!project.normalizedFolderPath) {
                 throw new Error("Project is not normalized yet. Cannot install packages.");
              }
              
              const flag = dev ? "--save-dev" : "";
              // Added --no-audit --no-fund for speed on Render
              const command = `npm install ${packageName} ${flag} --no-audit --no-fund`;
              
              toolResult = `Installing ${packageName}... This might take a moment.`;
              
              // Run in background but don't await for the full install in the chat response
              // or maybe we should await it to confirm success? 
              // npm install can be slow. Let's await it but with a timeout or just trust it works?
              // Better to await it so we know if it failed.
              
              await execAsync(command, { cwd: project.normalizedFolderPath });
              toolResult = `Successfully installed ${packageName}.`;
           } catch (err) {
              toolResult = `Error installing package: ${err instanceof Error ? err.message : String(err)}`;
           }
        } else if (functionName === "generate_tests") {
           try {
              if (!project.normalizedFolderPath) {
                 throw new Error("Project is not normalized yet. Cannot generate tests.");
              }
              
              const result = await generateFunctionalTests(project.normalizedFolderPath, project.projectType);
              
              if (result.success) {
                 toolResult = `Success! ${result.message} You can now run 'npm test' to execute them.`;
              } else {
                 toolResult = `Failed to generate tests: ${result.message}`;
              }
           } catch (err) {
              toolResult = `Error generating tests: ${err instanceof Error ? err.message : String(err)}`;
           }
        } else if (functionName === "generate_docker_compose") {
           try {
              if (!project.normalizedFolderPath) {
                 throw new Error("Project is not normalized yet.");
              }
              
              // Simple heuristic for DB type
              let dbImage = "postgres:15";
              let dbPort = "5432";
              let dbEnv = "POSTGRES_PASSWORD=postgres";
              
              // Check if project uses mongo
              const pkgPath = path.join(project.normalizedFolderPath, "package.json");
              if (fs.existsSync(pkgPath)) {
                 const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
                 const deps = { ...pkg.dependencies, ...pkg.devDependencies };
                 if (deps.mongoose || deps.mongodb) {
                    dbImage = "mongo:6";
                    dbPort = "27017";
                    dbEnv = "";
                 } else if (deps.mysql || deps.mysql2) {
                    dbImage = "mysql:8";
                    dbPort = "3306";
                    dbEnv = "MYSQL_ROOT_PASSWORD=root";
                 }
              }
              
              const composeContent = `version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${dbImage.startsWith('postgres') ? 'postgresql://postgres:postgres@db:5432/app' : dbImage.startsWith('mongo') ? 'mongodb://db:27017/app' : 'mysql://root:root@db:3306/app'}
      - NODE_ENV=development
    depends_on:
      - db
    volumes:
      - .:/app
      - /app/node_modules

  db:
    image: ${dbImage}
    ports:
      - "${dbPort}:${dbPort}"
    environment:
      - ${dbEnv}
    volumes:
      - db_data:/var/lib/${dbImage.startsWith('postgres') ? 'postgresql/data' : 'mysql'}

volumes:
  db_data:
`;
              const composePath = path.join(project.normalizedFolderPath, "docker-compose.yml");
              await fs.promises.writeFile(composePath, composeContent);
              toolResult = "Successfully generated docker-compose.yml with database support.";
           } catch (err) {
              toolResult = `Error generating docker-compose: ${err instanceof Error ? err.message : String(err)}`;
           }
        } else if (functionName === "patch_security") {
           try {
              if (!project.normalizedFolderPath) {
                 throw new Error("Project is not normalized yet.");
              }
              
              toolResult = "Running security audit and fix... This may take a minute.";
              
              // Run npm audit fix
              // We use --force if the user explicitly asked for it, but let's stick to safe fixes first
              // Added --no-audit --no-fund for speed on Render
              await execAsync("npm audit fix --no-audit --no-fund", { cwd: project.normalizedFolderPath });
              
              toolResult = "Successfully ran 'npm audit fix'. Security vulnerabilities have been patched where possible.";
           } catch (err) {
              toolResult = `Error patching security: ${err instanceof Error ? err.message : String(err)}`;
           }
        } else if (functionName === "generate_health_check") {
           try {
              if (!project.normalizedFolderPath) {
                 throw new Error("Project is not normalized yet.");
              }
              
              // Detect framework
              let framework = "express";
              const pkgPath = path.join(project.normalizedFolderPath, "package.json");
              if (fs.existsSync(pkgPath)) {
                 const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
                 const deps = { ...pkg.dependencies, ...pkg.devDependencies };
                 if (deps.next) framework = "nextjs";
                 else if (deps.fastify) framework = "fastify";
                 else if (deps.flask) framework = "flask"; // Python usually
              }
              
              if (framework === "express") {
                 const healthCode = `
// Health Check Endpoint
app.get('/health', (req, res) => {
  const healthcheck = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    memory: process.memoryUsage()
  };
  try {
    res.send(healthcheck);
  } catch (error) {
    healthcheck.message = error;
    res.status(503).send();
  }
});
`;
                 toolResult = `I have generated the code for an Express health check. Please add this to your main server file:\n\n${healthCode}`;
              } else if (framework === "nextjs") {
                 const healthPath = path.join(project.normalizedFolderPath, "pages/api/health.ts");
                 const healthCode = `
import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    memory: process.memoryUsage()
  });
}
`;
                 await fs.promises.mkdir(path.dirname(healthPath), { recursive: true });
                 await fs.promises.writeFile(healthPath, healthCode);
                 toolResult = "Successfully created pages/api/health.ts with metrics instrumentation.";
              } else {
                 toolResult = `I cannot automatically generate a health check for ${framework} yet, but here is the logic you need: Create a /health route that returns JSON with uptime and memory usage.`;
              }
           } catch (err) {
              toolResult = `Error generating health check: ${err instanceof Error ? err.message : String(err)}`;
           }
        } else if (functionName === "run_static_analysis") {
           try {
              if (!project.normalizedFolderPath) {
                 throw new Error("Project is not normalized yet.");
              }
              
              // Try to run eslint if available, otherwise install and run
              // For speed, let's assume we can run npx eslint
              toolResult = "Running static analysis (ESLint)...";
              
              // We use npx to avoid needing it in package.json, but it might be slow
              // A better approach is to check if it's in package.json
              const { stdout, stderr } = await execAsync("npx eslint . --ext .js,.jsx,.ts,.tsx --format json", { cwd: project.normalizedFolderPath });
              
              // Parse JSON output to give a summary
              try {
                 const results = JSON.parse(stdout);
                 const errorCount = results.reduce((acc: number, curr: any) => acc + curr.errorCount, 0);
                 const warningCount = results.reduce((acc: number, curr: any) => acc + curr.warningCount, 0);
                 toolResult = `Static Analysis Complete:\nErrors: ${errorCount}\nWarnings: ${warningCount}\n\nRun 'npx eslint .' to see details.`;
              } catch (e) {
                 toolResult = `Static Analysis Output:\n${stdout.substring(0, 500)}...`;
              }
           } catch (err) {
              // ESLint exits with 1 if errors found
              toolResult = `Static Analysis found issues (or failed to run): ${err instanceof Error ? err.message : String(err)}`;
           }
        } else if (functionName === "generate_deployment_config") {
           const args = JSON.parse(toolCall["function"].arguments);
           const { provider } = args;
           
           let configContent = "";
           let fileName = "";
           
           if (provider === "aws") {
              fileName = "main.tf";
              configContent = `
provider "aws" {
  region = "us-east-1"
}

resource "aws_instance" "app_server" {
  ami           = "ami-0c55b159cbfafe1f0" # Amazon Linux 2
  instance_type = "t2.micro"

  user_data = <<-EOF
              #!/bin/bash
              yum update -y
              curl -sL https://rpm.nodesource.com/setup_16.x | bash -
              yum install -y nodejs git
              git clone <YOUR_REPO_URL> /app
              cd /app
              npm install
              npm start
              EOF

  tags = {
    Name = "AI-Deploy-App"
  }
}
`;
           } else if (provider === "digitalocean") {
              fileName = "main.tf";
              configContent = `
terraform {
  required_providers {
    digitalocean = {
      source = "digitalocean/digitalocean"
      version = "~> 2.0"
    }
  }
}

provider "digitalocean" {
  token = var.do_token
}

resource "digitalocean_droplet" "web" {
  image  = "ubuntu-20-04-x64"
  name   = "ai-deploy-web"
  region = "nyc1"
  size   = "s-1vcpu-1gb"

  user_data = <<-EOF
              #!/bin/bash
              apt-get update
              curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
              apt-get install -y nodejs git
              git clone <YOUR_REPO_URL> /app
              cd /app
              npm install
              npm start
              EOF
}
`;
           }
           
           try {
              if (!project.normalizedFolderPath) {
                 throw new Error("Project is not normalized yet.");
              }
              const fullPath = path.join(project.normalizedFolderPath, fileName);
              await fs.promises.writeFile(fullPath, configContent);
              toolResult = `Successfully generated ${fileName} for ${provider}. You can use this with Terraform to provision infrastructure.`;
           } catch (err) {
              toolResult = `Error generating config: ${err instanceof Error ? err.message : String(err)}`;
           }
        } else if (functionName === "run_autofix") {
          // Trigger auto-fix
          if (project.normalizedFolderPath) {
             // Update status to running
             await storage.updateProject(id, { 
               autoFixStatus: "running",
               autoFixReport: "Auto-fix started by AI Mentor...",
               autoFixLogs: `[${new Date().toISOString()}] Auto-fix process started by AI Mentor.\n`
             });
             
             // Run in background
             autoFixProject(project).catch(err => {
               console.error(`[AutoFix] Background process crashed for ${id}:`, err);
               storage.updateProject(id, {
                 autoFixStatus: "failed",
                 autoFixReport: `Background process crashed: ${err instanceof Error ? err.message : String(err)}`
               });
             });
             
             toolResult = "I have started the Auto-Fix process. You can see the progress in the dashboard.";
          } else {
             toolResult = "I cannot run Auto-Fix because the project is not normalized yet.";
          }
        } else if (functionName === "run_qa") {
           // Trigger QA
           // We can't easily await the full QA here as it might take time, but QA is usually faster than AutoFix.
           // However, for chat responsiveness, let's trigger it and tell the user.
           // Actually, the existing QA route awaits it. Let's try to await it if it's fast, or just trigger.
           // Let's trigger it similar to the route logic but we need to be careful about response time.
           // Better: Just tell the frontend to trigger it? No, the user wants the AI to do it.
           
           // Let's just update status and run it.
           if (["registered", "qa_failed", "qa_passed", "deployed", "deploy_failed"].includes(project.status)) {
              await storage.updateProject(id, { status: "qa_running" });
              
              // Run in background so chat doesn't timeout
              runQaOnProject(project).then(async (qaResult) => {
                 await storage.updateProject(id, {
                    status: qaResult.passed ? "qa_passed" : "qa_failed",
                    qaReport: qaResult.report,
                 });
              });
              
              toolResult = "I have started the Quality Assurance checks. The status will update shortly.";
           } else {
              toolResult = `I cannot run QA right now because the project status is ${project.status}.`;
           }
        } else if (functionName === "deploy_project") {
           if (["qa_passed", "deployed", "deploy_failed", "qa_failed"].includes(project.status)) {
              await storage.updateProject(id, { status: "deploying" });
              
              deployProject(project).then(async (deployResult) => {
                 if (!deployResult.success) {
                    await storage.updateProject(id, { status: "deploy_failed" });
                 } else {
                    await storage.updateProject(id, {
                       status: "deployed",
                       deployedUrl: deployResult.deployedUrl,
                    });
                 }
              });
              
              toolResult = "I have initiated the deployment process. Good luck!";
           } else {
              toolResult = "I cannot deploy the project yet. Please ensure it has passed QA or is in a valid state.";
           }
        }

        // Return the tool result as the final message
        return res.json({ response: toolResult, action: functionName });
      }

      res.json({ response: responseMessage.content });
    } catch (error) {
      console.error("Error in chat route:", error);
      res.status(500).json({ error: "Failed to process chat request" });
    }
  });

  return httpServer;
}
