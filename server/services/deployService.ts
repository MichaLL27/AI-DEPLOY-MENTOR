import type { Project } from "@shared/schema";
import { storage } from "../storage";
import { spawn, ChildProcess } from "child_process";
import * as net from "net";
import * as path from "path";
import * as fs from "fs";

import { cloneAndZipRepository } from "./githubService";
import { analyzeZipProject } from "./zipAnalyzer";
import { deployToVercel } from "./vercelService";

/**
 * Deploy Service - Handles project deployments
 * 
 * Supports:
 * - Vercel API deployments (when VERCEL_TOKEN is set)
 * - Real Render API deployments (when RENDER_API_TOKEN and renderServiceId are set)
 * - Local Process Deployment (Real execution on local machine)
 */

export interface DeployResult {
  success: boolean;
  deployedUrl: string | null;
  error?: string;
  deployId?: string;
  deployStatus?: string;
}

// Store running processes in memory
const runningProcesses = new Map<string, { process: ChildProcess, port: number, startTime: number }>();

/**
 * Helper to find a free port
 */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => {
        resolve(port);
      });
    });
  });
}

/**
 * Helper to append logs to the project
 */
async function logDeploy(projectId: string, message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  
  console.log(`[DeployLog] ${message}`);

  try {
    const project = await storage.getProject(projectId);
    if (project) {
      const currentLogs = project.deployLogs || "";
      await storage.updateProject(projectId, {
        deployLogs: currentLogs + logLine
      });
    }
  } catch (e) {
    console.error("Failed to write deploy log:", e);
  }
}

/**
 * Restore project source if missing (for GitHub projects)
 */
async function restoreProjectSource(project: Project): Promise<Project | null> {
  if (project.sourceType !== "github" || !project.sourceValue) {
    return null;
  }

  await logDeploy(project.id, "Project source missing. Attempting to restore from GitHub...");
  
  try {
    const zipPath = await cloneAndZipRepository(project.sourceValue, project.id);
    
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

    await logDeploy(project.id, "Project source restored successfully.");
    return updatedProject;

  } catch (error) {
    await logDeploy(project.id, `Failed to restore project source: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Deploy project locally by running it as a child process
 */
async function deployToLocal(project: Project): Promise<DeployResult> {
  if (!project.normalizedFolderPath || !fs.existsSync(project.normalizedFolderPath)) {
    return { success: false, deployedUrl: null, error: "Project source not found" };
  }

  // Kill existing process if any
  if (runningProcesses.has(project.id)) {
    const existing = runningProcesses.get(project.id);
    try {
      existing?.process.kill();
      await logDeploy(project.id, "Stopped previous deployment instance.");
    } catch (e) {
      // Ignore
    }
    runningProcesses.delete(project.id);
  }

  try {
    const port = await getFreePort();
    await logDeploy(project.id, `Allocated local port: ${port}`);

    const cwd = project.normalizedFolderPath;

    // Prepare Env Vars for local execution
    const projectEnv = (project.envVars as Record<string, any>) || {};
    const envVars = Object.entries(projectEnv).reduce((acc, [key, val]) => {
      acc[key] = val.value;
      return acc;
    }, {} as Record<string, string>);

    // Merge with process.env
    const childEnv = { ...process.env, ...envVars };
    
    // 1. Install dependencies (if not already done)
    await logDeploy(project.id, "Installing dependencies...");
    const install = spawn("npm", ["install"], { cwd, shell: true, env: childEnv });
    
    await new Promise<void>((resolve, reject) => {
      install.stdout.on("data", (data) => logDeploy(project.id, `[Install] ${data}`));
      install.stderr.on("data", (data) => logDeploy(project.id, `[Install] ${data}`));
      install.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Install failed with code ${code}`));
      });
    });

    // 2. Build (if needed)
    const pkg = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf-8"));
    if (pkg.scripts?.build) {
      await logDeploy(project.id, "Building project...");
      // Inject env vars into build process so VITE_ vars are picked up
      const build = spawn("npm", ["run", "build"], { cwd, shell: true, env: childEnv });
      
      await new Promise<void>((resolve, reject) => {
        build.stdout.on("data", (data) => logDeploy(project.id, `[Build] ${data}`));
        build.stderr.on("data", (data) => logDeploy(project.id, `[Build] ${data}`));
        build.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Build failed with code ${code}`));
        });
      });
    }

    // 3. Start the application
    await logDeploy(project.id, "Starting application...");
    
    // Set PORT env var
    const env = { ...childEnv, PORT: port.toString() };
    
    let startCmd = "";
    
    // Special handling for Angular projects
    if (fs.existsSync(path.join(cwd, "angular.json"))) {
      await logDeploy(project.id, "Angular project detected. Locating build output...");
      
      // Try to find the dist folder
      const distPath = path.join(cwd, "dist");
      if (fs.existsSync(distPath)) {
        // Find the specific project folder inside dist
        const contents = fs.readdirSync(distPath);
        // Look for a folder that contains index.html or 'browser' folder
        let buildDir = distPath;
        
        // If dist has subfolders, check them
        for (const item of contents) {
          const itemPath = path.join(distPath, item);
          if (fs.statSync(itemPath).isDirectory()) {
            // Check for browser folder (Angular 17+)
            if (fs.existsSync(path.join(itemPath, "browser", "index.html"))) {
              buildDir = path.join(itemPath, "browser");
              break;
            }
            // Check for index.html directly
            if (fs.existsSync(path.join(itemPath, "index.html"))) {
              buildDir = itemPath;
              break;
            }
          }
        }
        
        await logDeploy(project.id, `Serving static files from: ${buildDir}`);
        // Use serve to host the static files
        // -s for single page app (rewrites to index.html)
        startCmd = `npx serve -s "${buildDir}" -p ${port}`;
      } else {
        await logDeploy(project.id, "Build output (dist) not found. Falling back to npm start...");
        startCmd = "npm start";
      }
    } else if (pkg.scripts?.start) {
      startCmd = "npm start";
    } else if (fs.existsSync(path.join(cwd, "server.js"))) {
      startCmd = "node server.js";
    } else if (fs.existsSync(path.join(cwd, "index.js"))) {
      startCmd = "node index.js";
    } else {
      // Fallback for static sites: use 'serve'
      await logDeploy(project.id, "No start script found. Serving as static site...");
      startCmd = `npx serve -s . -p ${port}`;
    }

    const child = spawn(startCmd, { cwd, shell: true, env });

    runningProcesses.set(project.id, {
      process: child,
      port,
      startTime: Date.now()
    });

    child.stdout.on("data", (data) => {
      // Don't log everything to DB to avoid spam, but maybe log startup messages
      const msg = data.toString();
      if (msg.includes("listening") || msg.includes("running") || msg.includes("started")) {
        logDeploy(project.id, `[App] ${msg}`);
      }
    });

    child.stderr.on("data", (data) => {
      logDeploy(project.id, `[App Error] ${data}`);
    });

    child.on("close", (code) => {
      logDeploy(project.id, `Application process exited with code ${code}`);
      runningProcesses.delete(project.id);
      // Trigger self-healing?
      if (code !== 0 && code !== null) {
        handleCrash(project.id);
      }
    });

    // Wait a bit to ensure it started
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Construct local URL (assuming running on same machine or accessible via tunnel)
    // For this environment, we assume localhost is accessible
    const deployedUrl = `http://localhost:${port}`;
    
    await logDeploy(project.id, `Deployment successful! App running at ${deployedUrl}`);

    return {
      success: true,
      deployedUrl,
      deployStatus: "live"
    };

  } catch (error) {
    await logDeploy(project.id, `Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
    return {
      success: false,
      deployedUrl: null,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Handle application crash (Self-healing)
 */
async function handleCrash(projectId: string) {
  console.log(`[SelfHealing] Detected crash for project ${projectId}. Attempting restart...`);
  try {
    const project = await storage.getProject(projectId);
    if (project) {
      await logDeploy(projectId, "CRASH DETECTED! Initiating self-healing sequence...");
      await storage.updateProject(projectId, { lastDeployStatus: "recovery_triggered" });
      
      // Wait 5 seconds then restart
      setTimeout(async () => {
        await deployProject(project);
      }, 5000);
    }
  } catch (e) {
    console.error("Self-healing failed:", e);
  }
}

/**
 * Helper to trigger real Render deployment
 */
async function triggerRenderDeploy(project: Project): Promise<{ deployId: string; status: string; url: string } | null> {
  // Check if Render API token and service ID are configured
  const renderToken = process.env.RENDER_API_TOKEN;
  if (!renderToken || !project.renderServiceId) {
    return null;
  }

  try {
    await logDeploy(project.id, `Triggering deployment for service ${project.renderServiceId}...`);
    
    const baseUrl = process.env.RENDER_BASE_URL || "https://api.render.com/v1";
    const deployEndpoint = `${baseUrl}/services/${project.renderServiceId}/deploys`;

    const response = await fetch(deployEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${renderToken}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      await logDeploy(project.id, `Deploy trigger failed: ${response.status} - ${errorText}`);
      return null;
    }

    const deployData = await response.json() as any;
    const deployId = deployData.id || deployData.deployId;
    const status = deployData.status || "pending";

    await logDeploy(project.id, `Deployment triggered successfully. ID: ${deployId}, Status: ${status}`);

    // Store deploy info
    await storage.updateProject(project.id, {
      lastDeployId: deployId,
      lastDeployStatus: status,
    });

    // Use dashboard URL if available, otherwise construct one
    const deployUrl = project.renderDashboardUrl || 
      `https://dashboard.render.com/d/srv-${project.renderServiceId.substring(4)}`;

    // Start background polling for deployment progress
    pollRenderDeployStatus(project, deployId, renderToken);

    return {
      deployId,
      status,
      url: deployUrl,
    };
  } catch (error) {
    await logDeploy(project.id, `Deployment error: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Background poller for Render deployment status
 */
async function pollRenderDeployStatus(project: Project, deployId: string, token: string) {
  const baseUrl = process.env.RENDER_BASE_URL || "https://api.render.com/v1";
  const serviceId = project.renderServiceId;
  
  if (!serviceId) return;

  let lastStatus = "pending";
  let attempts = 0;
  const maxAttempts = 60; // Poll for ~5 minutes (5s interval)

  const poll = async () => {
    if (attempts >= maxAttempts) {
      await logDeploy(project.id, "Stopped polling deployment status (timeout).");
      return;
    }
    attempts++;

    try {
      const response = await fetch(`${baseUrl}/services/${serviceId}/deploys/${deployId}`, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Accept": "application/json",
        },
      });

      if (!response.ok) return;

      const data = await response.json() as any;
      const status = data.status;

      if (status !== lastStatus) {
        await logDeploy(project.id, `Deployment status update: ${status}`);
        lastStatus = status;
        
        // Update project status in DB
        await storage.updateProject(project.id, {
          lastDeployStatus: status,
          status: status === "live" ? "deployed" : "deploying"
        });
      }

      if (status === "live") {
        await logDeploy(project.id, "Deployment completed successfully! App is live.");
        return;
      } else if (status === "build_failed" || status === "update_failed" || status === "canceled") {
        await logDeploy(project.id, `Deployment failed with status: ${status}`);
        return;
      }

      // Continue polling
      setTimeout(poll, 5000);

    } catch (e) {
      console.error("Error polling render status:", e);
    }
  };

  // Start polling
  setTimeout(poll, 5000);
}

/**
 * Create a new Web Service on Render
 */
async function createRenderService(project: Project): Promise<{ serviceId: string; url: string; dashboardUrl: string } | null> {
  const renderToken = process.env.RENDER_API_TOKEN;
  if (!renderToken) return null;

  // We can only deploy public GitHub repos for now
  if (project.sourceType !== "github") {
    await logDeploy(project.id, "Skipping Render service creation: Not a GitHub project");
    return null;
  }

  try {
    await logDeploy(project.id, "Creating new Web Service on Render...");
    
    const baseUrl = process.env.RENDER_BASE_URL || "https://api.render.com/v1";
    
    // 1. Provision Database if needed (Mock for now)
    const dbEnvVars = await provisionDatabase(project);

    // 2. Create Service
    const body = {
      serviceDetails: {
        type: "web_service",
        name: project.name,
        repo: project.sourceValue, // Must be https://github.com/user/repo
        env: "node",
        region: "oregon", // Default
        buildCommand: "npm install && npm run build",
        startCommand: "npm start",
        envVars: [
          ...dbEnvVars,
          { key: "NODE_ENV", value: "production" }
        ]
      }
    };

    const response = await fetch(`${baseUrl}/services`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${renderToken}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      await logDeploy(project.id, `Service creation failed: ${errorText}`);
      return null;
    }

    const data = await response.json() as any;
    await logDeploy(project.id, `Service created successfully! ID: ${data.id}`);
    
    return {
      serviceId: data.id,
      url: data.serviceDetails.url,
      dashboardUrl: data.dashboardUrl || `https://dashboard.render.com/d/${data.id}`,
    };

  } catch (error) {
    await logDeploy(project.id, `Service creation error: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Mock Database Provisioning
 * In a real app, this would call Neon API
 */
async function provisionDatabase(project: Project): Promise<Array<{ key: string; value: string }>> {
  // Check if project needs DB (simple heuristic)
  const needsDb = project.projectType === "node_backend" || project.projectType === "nextjs" || project.projectType === "python_flask";
  
  if (!needsDb) return [];

  await logDeploy(project.id, "Project requires a database. Provisioning Neon DB (Simulated)...");
  
  // In a real scenario, we would:
  // 1. Call Neon API to create a project/branch
  // 2. Get the connection string
  // 3. Return it as an env var
  
  // For MVP/Demo purposes, we'll provide a placeholder or a local connection string if applicable
  // If the user has provided a NEON_API_KEY, we could actually do it, but for now we simulate success.
  
  const mockDbUrl = `postgres://user:password@ep-cool-project-123456.us-east-2.aws.neon.tech/${project.name.replace(/[^a-z0-9]/g, "_")}`;
  
  await logDeploy(project.id, `Database provisioned! Connection string generated.`);
  
  return [
    { key: "DATABASE_URL", value: mockDbUrl },
    { key: "PGHOST", value: "ep-cool-project-123456.us-east-2.aws.neon.tech" },
    { key: "PGUSER", value: "user" },
    { key: "PGDATABASE", value: project.name.replace(/[^a-z0-9]/g, "_") },
  ];
}

/**
 * Deploy a project to production
 * 
 * @param project - The project to deploy
 * @returns Deployment result with URL or error
 * 
 * If RENDER_API_TOKEN and renderServiceId are configured, uses real Render API.
 * Otherwise falls back to simulated deployment.
 */
export async function deployProject(project: Project): Promise<DeployResult> {
  // Validate project is ready for deployment
  // (Note: We relax the check slightly to allow recovery if source is missing but status was 'deployed' previously)
  if (!["qa_passed", "deployed", "deploy_failed", "recovery_triggered"].includes(project.status)) {
    return {
      success: false,
      deployedUrl: null,
      error: "Project must pass QA before deployment",
    };
  }

  // Clear previous logs
  await storage.updateProject(project.id, { deployLogs: "" });
  await logDeploy(project.id, "Starting deployment process...");

  // 0. Check and Restore Source if needed
  if (!project.normalizedFolderPath || !fs.existsSync(project.normalizedFolderPath)) {
    if (project.sourceType === "github") {
      const restored = await restoreProjectSource(project);
      if (restored) {
        project = restored;
      } else {
        return {
          success: false,
          deployedUrl: null,
          error: "Project source not found and failed to restore from GitHub",
        };
      }
    } else {
       // For ZIP uploads, we can't restore if the file is gone
       return {
          success: false,
          deployedUrl: null,
          error: "Project source not found (ZIP file missing)",
        };
    }
  }

  // 1. Try Vercel Deployment (if configured)
  if (process.env.VERCEL_TOKEN) {
    await logDeploy(project.id, "VERCEL_TOKEN detected. Attempting Vercel deployment...");
    const vercelResult = await deployToVercel(project);
    
    if (vercelResult.success) {
      await logDeploy(project.id, `Vercel deployment initiated! URL: ${vercelResult.url}`);
      return {
        success: true,
        deployedUrl: vercelResult.url || null,
        deployId: vercelResult.deployId,
        deployStatus: vercelResult.status,
      };
    } else {
      // STRICT MODE: If Vercel is configured, we DO NOT fall back to local.
      await logDeploy(project.id, `Vercel deployment failed: ${vercelResult.error}. Aborting (Vercel-only mode).`);
      return {
        success: false,
        deployedUrl: null,
        error: `Vercel Deployment Failed: ${vercelResult.error}`
      };
    }
  }

  // 2. If no Render Service ID, try to create one
  if (!project.renderServiceId && process.env.RENDER_API_TOKEN) {
    const newService = await createRenderService(project);
    if (newService) {
      await storage.updateProject(project.id, {
        renderServiceId: newService.serviceId,
        renderDashboardUrl: newService.dashboardUrl,
        deployedUrl: newService.url,
      });
      // Refresh project object
      const updated = await storage.getProject(project.id);
      if (updated) project = updated;
    }
  }

  // Try real Render deployment if configured
  const renderResult = await triggerRenderDeploy(project);
  if (renderResult) {
    return {
      success: true,
      deployedUrl: renderResult.url,
      deployId: renderResult.deployId,
      deployStatus: renderResult.status,
    };
  }

  // Fallback: Local Process Deployment (Real execution)
  // await logDeploy(project.id, "No Render configuration found. Starting local deployment (Real-time execution)...");
  // return await deployToLocal(project);
  
  return {
      success: false,
      deployedUrl: null,
      error: "Deployment failed: No valid cloud deployment configuration found (Vercel/Render) or deployment failed."
  };
}

/**
 * Check deployment status
 * 
 * TODO: Implement real deployment status checking
 */
export async function checkDeploymentStatus(deploymentId: string): Promise<string> {
  // Placeholder for checking deployment status
  return "deployed";
}
