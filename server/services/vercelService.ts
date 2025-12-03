import type { Project } from "@shared/schema";
import type { EnvVar } from "./envService";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

export interface VercelDeployResult {
  success: boolean;
  url?: string;
  dashboardUrl?: string;
  error?: string;
  deployId?: string;
  status?: string;
}

async function getGithubRepoInfo(owner: string, repo: string): Promise<{ id: number, defaultBranch: string } | null> {
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
      console.error(`[GitHub] Failed to fetch repo info: ${res.status} ${res.statusText}`);
      return null;
    }
    
    const data = await res.json();
    return { id: data.id, defaultBranch: data.default_branch };
  } catch (e) {
    console.error("[GitHub] Error fetching repo info:", e);
    return null;
  }
}

export async function syncEnvVarsToVercel(project: Project): Promise<{ success: boolean; error?: string }> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    return { success: false, error: "VERCEL_TOKEN not configured" };
  }

  const sanitizedName = project.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/--+/g, '-').slice(0, 100);
  const envVars = (project.envVars as Record<string, EnvVar>) || {};
  
  console.log(`[Vercel] Syncing env vars for ${sanitizedName}...`);

  try {
    // 1. Get Project ID
    const getRes = await fetch(`https://api.vercel.com/v9/projects/${sanitizedName}`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (!getRes.ok) {
      if (getRes.status === 404) {
        // Project doesn't exist yet, we can't sync. 
        // This is fine if we haven't deployed yet, but if we are "syncing", we expect it to exist or be created.
        // For now, let's assume we only sync if it exists. If not, ensureVercelProject will handle it during deploy.
        return { success: true }; 
      }
      return { success: false, error: `Failed to fetch Vercel project: ${getRes.statusText}` };
    }
    
    const vercelProject = await getRes.json();
    const projectId = vercelProject.id;

    // 2. List existing Vercel Env Vars
    // Note: Vercel API pagination might be needed for > 20 vars, but for MVP we assume < 20
    const listRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
      headers: { "Authorization": `Bearer ${token}` }
    });
    
    if (!listRes.ok) {
      return { success: false, error: "Failed to list Vercel env vars" };
    }
    
    const { envs } = await listRes.json() as { envs: any[] };
    
    // 3. Sync Logic
    // A. Delete variables that are in Vercel but NOT in our DB
    for (const vercelEnv of envs) {
      // Only check production target vars to avoid deleting unrelated stuff if possible, 
      // but usually we want to sync everything.
      // If the key is NOT in our local envVars, delete it.
      if (!envVars[vercelEnv.key]) {
        console.log(`[Vercel] Deleting env var: ${vercelEnv.key}`);
        const deleteRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env/${vercelEnv.id}`, {
          method: "DELETE",
          headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (!deleteRes.ok) {
          console.error(`[Vercel] Failed to delete ${vercelEnv.key}:`, await deleteRes.text());
          // We continue even if delete fails
        }
      }
    }

    // B. Create or Update variables from our DB
    for (const [key, localVar] of Object.entries(envVars)) {
      const existing = envs.find((e: any) => e.key === key && e.target.includes("production"));
      
      const body = {
        key,
        value: localVar.value,
        type: localVar.isSecret ? "encrypted" : "plain",
        target: ["production", "preview", "development"]
      };

      if (existing) {
        // Update if value changed (we can't easily check value if encrypted, so we just update)
        // Or we can just update always to be safe.
        // Vercel requires ID to update.
        console.log(`[Vercel] Updating env var: ${key}`);
        const updateRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env/${existing.id}`, {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });
        
        if (!updateRes.ok) {
          console.error(`[Vercel] Failed to update ${key}:`, await updateRes.text());
          return { success: false, error: `Failed to update env var ${key}` };
        }
      } else {
        // Create
        console.log(`[Vercel] Creating env var: ${key}`);
        const createRes = await fetch(`https://api.vercel.com/v9/projects/${projectId}/env`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body)
        });

        if (!createRes.ok) {
          console.error(`[Vercel] Failed to create ${key}:`, await createRes.text());
          return { success: false, error: `Failed to create env var ${key}` };
        }
      }
    }

    console.log(`[Vercel] Env vars synced successfully.`);
    return { success: true };

  } catch (error) {
    console.error("[Vercel] Sync error:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function ensureVercelProject(
  name: string, 
  envVars: any[], 
  token: string,
  repoInfo?: { type: string, repo: string, repoId: number | string }
) {
  console.log(`[Vercel] Ensuring project '${name}' exists and has env vars...`);
  
  const body: any = {
    name,
    environmentVariables: envVars,
    framework: null
  };

  if (repoInfo) {
    body.gitRepository = repoInfo;
  }
  
  // 1. Try to create project
  const createRes = await fetch("https://api.vercel.com/v9/projects", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
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

async function deployZipToVercel(project: Project, token: string, envVars: any[]): Promise<VercelDeployResult> {
  if (!project.normalizedFolderPath || !fs.existsSync(project.normalizedFolderPath)) {
    return { success: false, error: "Project source files not found (normalized folder missing)" };
  }

  const sanitizedName = project.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/--+/g, '-').slice(0, 100);

  // Ensure project exists (without git repo)
  await ensureVercelProject(sanitizedName, envVars, token);

  // 1. Collect files and calculate hashes
  const files: { file: string; sha: string; size: number; path: string }[] = [];
  
  function walk(dir: string, root: string) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        if (item !== "node_modules" && item !== ".git") {
          walk(fullPath, root);
        }
      } else {
        const content = fs.readFileSync(fullPath);
        const sha = crypto.createHash('sha1').update(content).digest('hex');
        const relPath = path.relative(root, fullPath).replace(/\\/g, '/');
        
        files.push({
          file: relPath,
          sha,
          size: stat.size,
          path: fullPath
        });
      }
    }
  }

  walk(project.normalizedFolderPath, project.normalizedFolderPath);
  console.log(`[Vercel] Prepared ${files.length} files for upload.`);

  // 2. Create Deployment (Check for missing files)
  const deployBody = {
    name: sanitizedName,
    files: files.map(f => ({ file: f.file, sha: f.sha, size: f.size })),
    projectSettings: { framework: null }
  };

  let deployRes = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(deployBody),
  });

  // 3. Handle missing files
  if (deployRes.status === 400) { // Often returns 400 or specific error for missing files? No, usually returns error object
     // Actually Vercel API returns 200 OK but with error code inside if files are missing?
     // Or maybe it returns 400 Bad Request?
     // Documentation says: "If any of the files are not already uploaded... the response will contain error code missing_files"
  }
  
  let deployData = await deployRes.json();

  if (deployData.error && deployData.error.code === 'missing_files') {
    console.log(`[Vercel] Uploading ${deployData.error.missing.length} missing files...`);
    
    const missingShas = new Set(deployData.error.missing);
    const filesToUpload = files.filter(f => missingShas.has(f.sha));

    for (const file of filesToUpload) {
      const content = fs.readFileSync(file.path);
      await fetch("https://api.vercel.com/v2/files", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "x-vercel-digest": file.sha,
          "x-vercel-size": file.size.toString()
        },
        body: content as any
      });
    }

    console.log("[Vercel] Missing files uploaded. Retrying deployment...");
    
    // Retry deployment
    deployRes = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(deployBody),
    });
    
    deployData = await deployRes.json();
  }

  if (!deployRes.ok || deployData.error) {
    const err = deployData.error ? JSON.stringify(deployData.error) : await deployRes.text();
    console.error(`[Vercel] Deployment failed: ${err}`);
    return { success: false, error: `Vercel API Error: ${err}` };
  }

  const ownerName = deployData.owner?.username || 'team';
  const projectName = deployData.name || deployBody.name;

  return {
    success: true,
    url: `https://${deployData.url}`,
    dashboardUrl: `https://vercel.com/${ownerName}/${projectName}/deployments/${deployData.id}`,
    deployId: deployData.id,
    status: deployData.readyState
  };
}

export async function deployToVercel(project: Project): Promise<VercelDeployResult> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) {
    return { success: false, error: "VERCEL_TOKEN not configured" };
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

  // ALWAYS prefer ZIP deployment if we have local files.
  // This ensures we deploy the "Fixed" version and avoids GitHub permission issues.
  if (project.normalizedFolderPath && fs.existsSync(project.normalizedFolderPath)) {
     console.log(`[Vercel] Deploying from local files (normalized) to ensure fixes are applied...`);
     return deployZipToVercel(project, token, vercelEnv);
  }

  // Handle ZIP Deployment (Fallback)
  if (project.sourceType === "zip") {
    return deployZipToVercel(project, token, vercelEnv);
  }

  if (project.sourceType !== "github" || !project.sourceValue) {
    return { success: false, error: "Only GitHub and ZIP projects are supported for Vercel deployment currently" };
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

    // Fetch Repo Info (Required for Vercel API v13)
    const repoInfo = await getGithubRepoInfo(owner, repoName);
    if (!repoInfo) {
      return { 
        success: false, 
        error: "Could not fetch GitHub Repository info. Ensure the repository exists and is public, or configure GITHUB_TOKEN." 
      };
    }
    const { id: repoId, defaultBranch } = repoInfo;

    // Sanitize Project Name
    const sanitizedName = project.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-').replace(/--+/g, '-').slice(0, 100);

    // Ensure Project Exists & Has Env Vars
    await ensureVercelProject(
      sanitizedName, 
      vercelEnv, 
      token,
      { type: "github", repo: fullRepo, repoId }
    );

    // Prepare deployment payload
    // We use the 'gitSource' parameter to tell Vercel to pull from GitHub
    const deployBody = {
      name: sanitizedName,
      gitSource: {
        type: "github",
        repo: fullRepo,
        ref: defaultBranch || "main", // Use detected default branch
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
