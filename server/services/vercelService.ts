import type { Project } from "@shared/schema";
import type { EnvVar } from "./envService";

export interface VercelDeployResult {
  success: boolean;
  url?: string;
  dashboardUrl?: string;
  error?: string;
  deployId?: string;
  status?: string;
}

async function getGithubRepoId(owner: string, repo: string): Promise<string | number | null> {
  try {
    const headers: Record<string, string> = {
      "User-Agent": "AI-Deploy-Mentor",
      "Accept": "application/vnd.github.v3+json"
    };
    
    if (process.env.GITHUB_TOKEN) {
      headers["Authorization"] = `token ${process.env.GITHUB_TOKEN}`;
    }

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!res.ok) {
      console.error(`[GitHub] Failed to fetch repo ID: ${res.status} ${res.statusText}`);
      return null;
    }
    
    const data = await res.json();
    return data.id;
  } catch (e) {
    console.error("[GitHub] Error fetching repo ID:", e);
    return null;
  }
}

async function ensureVercelProject(
  name: string, 
  envVars: any[], 
  repoInfo: { type: string, repo: string, repoId: number | string }, 
  token: string
) {
  console.log(`[Vercel] Ensuring project '${name}' exists and has env vars...`);
  
  // 1. Try to create project
  const createRes = await fetch("https://api.vercel.com/v9/projects", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name,
      environmentVariables: envVars,
      framework: null,
      gitRepository: repoInfo
    })
  });

  if (createRes.ok) {
    console.log(`[Vercel] Project '${name}' created successfully.`);
    return await createRes.json();
  }

  const error = await createRes.json();
  if (error.error?.code === "project_already_exists") {
    console.log(`[Vercel] Project '${name}' already exists. Updating env vars...`);
    // Project exists, we need to get its ID to update env vars
    const getRes = await fetch(`https://api.vercel.com/v9/projects/${name}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (!getRes.ok) return null;
    const project = await getRes.json();
    
    // Update Env Vars (Upsert-ish)
    for (const env of envVars) {
      // Try to add. If it fails (duplicate), we ignore for now.
      await fetch(`https://api.vercel.com/v9/projects/${project.id}/env`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(env)
      }).catch(() => {});
    }
    return project;
  }
  
  console.error("[Vercel] Failed to create project:", error);
  return null;
}

export async function deployToVercel(project: Project): Promise<VercelDeployResult> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    return { success: false, error: "VERCEL_TOKEN not configured" };
  }

  if (project.sourceType !== "github" || !project.sourceValue) {
    return { success: false, error: "Only GitHub projects are supported for Vercel deployment currently" };
  }

  try {
    // Extract repo info from URL (https://github.com/user/repo)
    const match = project.sourceValue.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      return { success: false, error: "Invalid GitHub URL" };
    }
    const [_, owner, repo] = match;
    const repoName = repo.replace(".git", "");
    const fullRepo = `${owner}/${repoName}`;

    console.log(`[Vercel] Deploying ${fullRepo} to Vercel...`);

    // Fetch Repo ID (Required for Vercel API v13)
    const repoId = await getGithubRepoId(owner, repoName);
    if (!repoId) {
      return { 
        success: false, 
        error: "Could not fetch GitHub Repository ID. Ensure the repository exists and is public, or configure GITHUB_TOKEN." 
      };
    }

    // Prepare Env Vars
    const envVars = (project.envVars as Record<string, EnvVar>) || {};
    console.log(`[Vercel] Preparing env vars for deployment. Keys: ${Object.keys(envVars).join(", ")}`);

    const vercelEnv = Object.values(envVars).map(v => ({
      key: v.key,
      value: v.value,
      type: v.isSecret ? "encrypted" : "plain",
      target: ["production", "preview", "development"]
    }));

    // Sanitize Project Name
    const sanitizedName = project.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/--+/g, '-').slice(0, 100);

    // Ensure Project Exists & Has Env Vars
    await ensureVercelProject(
      sanitizedName, 
      vercelEnv, 
      { type: "github", repo: fullRepo, repoId }, 
      token
    );

    // Prepare deployment payload
    // We use the 'gitSource' parameter to tell Vercel to pull from GitHub
    const deployBody = {
      name: sanitizedName,
      gitSource: {
        type: "github",
        repo: fullRepo,
        ref: "main", // Default to main
        repoId: repoId // Added repoId
      },
      projectSettings: {
        framework: null // Let Vercel detect
      }
      // Note: 'env' payload is ignored for gitSource deployments, so we rely on ensureVercelProject
    };
    
    console.log(`[Vercel] Sending deployment payload...`);

    const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(deployBody),
    });

    if (!deployRes.ok) {
      const err = await deployRes.text();
      console.error(`[Vercel] Deployment failed: ${err}`);
      return { success: false, error: `Vercel API Error: ${err}` };
    }

    const deployData = await deployRes.json();
    
    // Safe access to owner username
    const ownerName = deployData.owner?.username || 'team';
    const projectName = deployData.name || deployBody.name;

    return {
      success: true,
      url: `https://${deployData.url}`, // This is the deployment URL
      dashboardUrl: `https://vercel.com/${ownerName}/${projectName}/deployments/${deployData.id}`,
      deployId: deployData.id,
      status: deployData.readyState // QUEUED, BUILDING, READY, etc.
    };

  } catch (error) {
    console.error("[Vercel] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
