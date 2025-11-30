import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import AdmZip from "adm-zip";
import type { Project } from "@shared/schema";
import { classifyProject } from "./projectClassifier";
import { normalizeProjectStructure } from "./projectNormalizer";

/**
 * Analyze an uploaded ZIP project to detect type and structure
 */
export async function analyzeZipProject(project: Project): Promise<{
  projectType: string;
  projectValidity: string;
  validationErrors: string[];
  analysisReport: string;
  normalizedStatus: string;
  normalizedFolderPath: string | null;
  normalizedReport: string;
  readyForDeploy: boolean;
}> {
  console.log(`[ZipAnalyzer] Analyzing project ${project.id}. Type: ${project.sourceType}, Path: ${project.zipStoredPath}`);

  // Validate source type and path
  if ((project.sourceType !== "zip" && project.sourceType !== "github") || !project.zipStoredPath) {
    throw new Error(`Project must be ZIP type with stored path. Got type: ${project.sourceType}, path: ${project.zipStoredPath}`);
  }

  if (!fs.existsSync(project.zipStoredPath)) {
    throw new Error("ZIP file not found at stored path");
  }

  // Create temp extraction directory
  const isVercel = process.env.VERCEL === "1";
  const extractDir = isVercel
    ? path.join(os.tmpdir(), "zip-analysis", project.id)
    : path.join(process.cwd(), "tmp", "zip-analysis", project.id);
    
  fs.mkdirSync(extractDir, { recursive: true });

  try {
    // Extract ZIP
    const zip = new AdmZip(project.zipStoredPath);
    zip.extractAllTo(extractDir, true);

    // Scan for project markers
    const files = listFilesRecursive(extractDir);
    const relativePaths = files.map(f => path.relative(extractDir, f).replace(/\\/g, "/"));

    // Detect project type
    const hasPackageJson = relativePaths.some(p => p === "package.json" || p.endsWith("/package.json"));
    const hasNextConfig = relativePaths.some(p => p === "next.config.js" || p === "next.config.ts");
    const hasIndexHtml = relativePaths.some(p => p === "index.html" || p.includes("public/index.html"));
    const hasServerFile = relativePaths.some(p => 
      /^(server\.(js|ts)|app\.(js|ts)|index\.(js|ts)|src\/(server|app|index)\.(js|ts))$/.test(p)
    );

    let projectType = "unknown";
    let typeDescription = "Unknown project type";

    if (hasPackageJson && hasNextConfig) {
      projectType = "nextjs";
      typeDescription = "Next.js application";
    } else if (hasPackageJson && hasServerFile) {
      projectType = "node_backend";
      typeDescription = "Node.js backend";
    } else if (hasIndexHtml) {
      projectType = "static_web";
      typeDescription = "Static website";
    }

    // Parse package.json if available
    let dependencies = "";
    const packageJsonPath = path.join(extractDir, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
        const deps = Object.keys(pkg.dependencies || {}).slice(0, 5);
        dependencies = deps.join(", ");
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Build report
    let report = `Project ZIP Analysis Report
================================

Detected Type: ${typeDescription}
Project Type: ${projectType}

Files Found:
`;

    // List key files
    const keyFiles = relativePaths.filter(p => 
      p.endsWith(".json") || 
      p.endsWith(".html") || 
      p.endsWith(".js") || 
      p.endsWith(".ts") ||
      p.includes("package.json") ||
      p.includes("index.html") ||
      p.includes("public/")
    ).slice(0, 10);

    keyFiles.forEach(f => {
      report += `  - ${f}\n`;
    });

    if (dependencies) {
      report += `\nDependencies: ${dependencies}\n`;
    }

    report += `\nRecommended Deployment: `;

    if (projectType === "nextjs") {
      report += "Vercel or similar Node.js hosting";
    } else if (projectType === "node_backend") {
      report += "Node.js service (e.g., Render web service)";
    } else if (projectType === "static_web") {
      report += "Static hosting (e.g., Vercel static, Netlify)";
    } else {
      report += "Manual configuration required";
    }

    // Run full classification on extracted folder
    const classification = await classifyProject(extractDir);

    // Create a mock project for normalizer
    const mockProject: Partial<Project> = {
      id: project.id,
      projectType: classification.projectType,
    };

    // Normalize the project structure
    const normalization = await normalizeProjectStructure(mockProject as Project, extractDir);

    // Cleanup temp extraction
    try {
      fs.rmSync(extractDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }

    return {
      projectType: classification.projectType,
      projectValidity: classification.projectValidity,
      validationErrors: classification.validationErrors,
      normalizedStatus: normalization.normalizedStatus,
      normalizedFolderPath: normalization.normalizedFolderPath,
      normalizedReport: normalization.normalizedReport,
      readyForDeploy: normalization.readyForDeploy,
      analysisReport: report,
    };
  } catch (error) {
    // Cleanup on error
    try {
      fs.rmSync(extractDir, { recursive: true, force: true });
    } catch {}

    throw error;
  }
}

/**
 * Recursively list files in a directory
 */
function listFilesRecursive(dir: string): string[] {
  const files: string[] = [];

  function walk(current: string) {
    try {
      const items = fs.readdirSync(current);
      items.forEach(item => {
        const itemPath = path.join(current, item);
        try {
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory()) {
            walk(itemPath);
          } else {
            files.push(itemPath);
          }
        } catch (e) {
          // Skip unreadable items
        }
      });
    } catch (e) {
      // Skip unreadable directories
    }
  }

  walk(dir);
  return files;
}
