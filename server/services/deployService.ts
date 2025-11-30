import type { Project } from "@shared/schema";
import { storage } from "../storage";

/**
 * Deploy Service - Handles project deployments
 * 
 * Supports:
 * - Real Render API deployments (when RENDER_API_TOKEN and renderServiceId are set)
 * - Simulated deployments as fallback
 */

export interface DeployResult {
  success: boolean;
  deployedUrl: string | null;
  error?: string;
  deployId?: string;
  deployStatus?: string;
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
    const baseUrl = process.env.RENDER_BASE_URL || "https://api.render.com/v1";
    const deployEndpoint = `${baseUrl}/services/${project.renderServiceId}/deploys`;

    console.log(`[Render] Triggering deploy for service: ${project.renderServiceId}`);

    const response = await fetch(deployEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${renderToken}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Render] Deploy failed with status ${response.status}:`, errorText);
      return null;
    }

    const deployData = await response.json() as any;
    const deployId = deployData.id || deployData.deployId;
    const status = deployData.status || "pending";

    console.log(`[Render] Deploy triggered with ID: ${deployId}, status: ${status}`);

    // Store deploy info
    await storage.updateProject(project.id, {
      lastDeployId: deployId,
      lastDeployStatus: status,
    });

    // Use dashboard URL if available, otherwise construct one
    const deployUrl = project.renderDashboardUrl || 
      `https://dashboard.render.com/d/srv-${project.renderServiceId.substring(4)}`;

    return {
      deployId,
      status,
      url: deployUrl,
    };
  } catch (error) {
    console.error("[Render] Deploy error:", error);
    return null;
  }
}

/**
 * Create a new Web Service on Render
 */
async function createRenderService(project: Project): Promise<{ serviceId: string; url: string; dashboardUrl: string } | null> {
  const renderToken = process.env.RENDER_API_TOKEN;
  if (!renderToken) return null;

  // We can only deploy public GitHub repos for now
  if (project.sourceType !== "github") {
    console.log("[Render] Skipping service creation: Not a GitHub project");
    return null;
  }

  try {
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

    console.log(`[Render] Creating new service for ${project.name}...`);

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
      console.error(`[Render] Create service failed: ${errorText}`);
      return null;
    }

    const data = await response.json() as any;
    return {
      serviceId: data.id,
      url: data.serviceDetails.url,
      dashboardUrl: data.dashboardUrl || `https://dashboard.render.com/d/${data.id}`,
    };

  } catch (error) {
    console.error("[Render] Create service error:", error);
    return null;
  }
}

/**
 * Mock Database Provisioning
 * In a real app, this would call Neon API
 */
async function provisionDatabase(project: Project): Promise<Array<{ key: string; value: string }>> {
  // Check if project needs DB (simple heuristic)
  // This would ideally come from the analysis phase
  const needsDb = project.projectType === "node_backend" || project.projectType === "nextjs";
  
  if (!needsDb) return [];

  console.log("[Deploy] Project might need a database. Provisioning logic would go here.");
  
  // If we had a NEON_API_KEY, we would create a DB here.
  // For now, we return a placeholder or nothing.
  return [];
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
  if (project.status !== "qa_passed") {
    return {
      success: false,
      deployedUrl: null,
      error: "Project must pass QA before deployment",
    };
  }

  // 1. If no Render Service ID, try to create one
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

  // Fallback: simulate deployment (2-3 seconds)
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000));

  const deployedUrl = generateDeployUrl(project);

  return {
    success: true,
    deployedUrl,
  };
}

/**
 * Generate a simulated deployment URL
 * 
 * TODO: Replace with actual deployment URL from Vercel/Render
 */
function generateDeployUrl(project: Project): string {
  // Create a URL-friendly slug from project name
  const slug = project.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  
  // Simulate Vercel-style URL
  return `https://${slug}-${project.id.slice(0, 8)}.vercel.app`;
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
