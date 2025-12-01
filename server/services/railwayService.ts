import type { Project } from "@shared/schema";

/**
 * Railway Service - Handles interactions with Railway API
 * 
 * Requires:
 * - RAILWAY_TOKEN env var
 */

const RAILWAY_API_URL = "https://backboard.railway.app/graphql/v2";

interface RailwayDeployResult {
  success: boolean;
  url?: string;
  deployId?: string;
  status?: string;
  error?: string;
}

/**
 * Sync Environment Variables to Railway
 */
export async function syncEnvVarsToRailway(project: Project): Promise<{ success: boolean; error?: string }> {
  const token = process.env.RAILWAY_TOKEN;
  // We need a Railway Project ID or Service ID stored in the project
  // For now, we'll assume the user might have stored it in a generic field or we look it up
  const railwayServiceId = project.railwayServiceId;

  if (!token || !railwayServiceId) {
    return { success: true }; // Skip if not configured
  }

  try {
    console.log(`[Railway] Syncing env vars for project ${project.id}...`);
    
    const envVars = (project.envVars as Record<string, any>) || {};
    
    // Railway GraphQL Mutation for Upserting Variables
    // We need to format vars as { name: "KEY", value: "VAL" }
    const variables = Object.entries(envVars).map(([key, val]) => ({
      name: key,
      value: val.value
    }));

    // Note: This is a simplified mutation. Real Railway API requires specific inputs.
    // We use a variableUpsert mutation usually.
    const query = `
      mutation variableUpsert($serviceId: String!, $variables: [VariableUpsertInput!]!) {
        variableUpsert(input: { serviceId: $serviceId, variables: $variables }) {
          ok
        }
      }
    `;

    const response = await fetch(RAILWAY_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: {
          serviceId: railwayServiceId,
          variables: variables.map(v => ({ name: v.name, value: v.value, projectId: project.railwayProjectId }))
        }
      }),
    });

    const data = await response.json() as any;

    if (data.errors) {
      return { success: false, error: data.errors[0].message };
    }

    return { success: true };

  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Deploy to Railway
 * (Trigger a redeploy)
 */
export async function deployToRailway(project: Project): Promise<RailwayDeployResult> {
  const token = process.env.RAILWAY_TOKEN;
  const railwayServiceId = project.railwayServiceId;

  if (!token || !railwayServiceId) {
    return { success: false, error: "Railway not configured (Missing Token or Service ID)" };
  }

  try {
    console.log(`[Railway] Triggering deployment for ${project.id}...`);

    // GraphQL mutation to trigger deploy
    const query = `
      mutation serviceDeploy($serviceId: String!) {
        serviceDeploy(input: { serviceId: $serviceId }) {
          id
          status
          url
        }
      }
    `;

    const response = await fetch(RAILWAY_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        variables: { serviceId: railwayServiceId }
      }),
    });

    const data = await response.json() as any;

    if (data.errors) {
      return { success: false, error: data.errors[0].message };
    }

    const deploy = data.data.serviceDeploy;

    return {
      success: true,
      deployId: deploy.id,
      status: deploy.status,
      url: deploy.url
    };

  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
