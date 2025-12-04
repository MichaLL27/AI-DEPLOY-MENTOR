import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { cloneAndZipRepository } from "./githubService";
import { storage } from "../storage";
import { analyzeZipProject } from "./zipAnalyzer";
import type { Project } from "@shared/schema";

async function downloadZip(url: string, projectId: string): Promise<string> {
  const isVercel = process.env.VERCEL === "1";
  const isRender = process.env.RENDER === "true";
  const baseDir = (isVercel || isRender) ? os.tmpdir() : process.cwd();
  const zipPath = path.join(baseDir, "uploads", "projects", projectId, "source.zip");

  // Ensure directory exists
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });

  console.log(`[Import] Downloading ZIP from ${url}...`);
  
  // Add headers to mimic a browser request to avoid 403 Forbidden from Replit
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to download ZIP from ${url}: ${response.status} ${response.statusText}. If this is a private Replit, please download the ZIP manually and use the 'Upload ZIP' option.`);
  }

  const buffer = await response.arrayBuffer();
  
  // Validate ZIP magic bytes (PK..)
  const header = new Uint8Array(buffer.slice(0, 4));
  if (header[0] !== 0x50 || header[1] !== 0x4B || header[2] !== 0x03 || header[3] !== 0x04) {
    throw new Error(`Downloaded file is not a valid ZIP (Magic bytes: ${header[0].toString(16)} ${header[1].toString(16)}...). It might be a login page or error page.`);
  }

  fs.writeFileSync(zipPath, Buffer.from(buffer));
  
  return zipPath;
}

/**
 * Handles import from various providers by normalizing the URL and using git clone
 */
export async function importProjectFromUrl(
  projectId: string,
  url: string,
  provider: "replit" | "lovable" | "base44" | "github"
): Promise<Project> {
  console.log(`[Import] Starting import for ${projectId} from ${provider} (${url})`);

  let zipPath: string;

  try {
    if (provider === "replit") {
      // Replit: Use ZIP download instead of git clone for better reliability with public projects
      // Convert https://replit.com/@user/slug to https://replit.com/@user/slug.zip
      let cleanUrl = url.replace(/\.git$/, "").replace(/\/$/, "");
      
      if (!cleanUrl.endsWith(".zip")) {
        cleanUrl = `${cleanUrl}.zip`;
      }
      
      zipPath = await downloadZip(cleanUrl, projectId);
    } else {
      // GitHub/Lovable/Base44: Use Git Clone
      let gitUrl = url;

      if (provider === "lovable") {
        // Lovable usually exports to GitHub, so we expect a GitHub URL or similar
      }

      // Reuse the GitHub cloning logic
      zipPath = await cloneAndZipRepository(gitUrl, projectId);
    }

    // Update project with ZIP path
    let updatedProject = await storage.updateProject(projectId, {
      zipStoredPath: zipPath,
      zipOriginalFilename: `${provider}-source.zip`,
      zipAnalysisStatus: "pending",
    } as any);

    // Analyze the imported project
    const analysis = await analyzeZipProject(updatedProject!);

    updatedProject = await storage.updateProject(projectId, {
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
    } as any);

    console.log(`[Import] Successfully imported from ${provider}`);
    return updatedProject!;
  } catch (error) {
    console.error(`[Import] Failed to import from ${provider}:`, error);
    
    const failedProject = await storage.updateProject(projectId, {
      zipAnalysisStatus: "failed",
      zipAnalysisReport: `Import from ${provider} failed: ${error instanceof Error ? error.message : String(error)}`,
    } as any);
    
    throw error;
  }
}
