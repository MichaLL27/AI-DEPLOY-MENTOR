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
