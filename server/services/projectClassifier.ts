import * as fs from "fs";
import * as path from "path";

export type ProjectType = "static_web" | "node_backend" | "nextjs" | "react_spa" | "angular" | "python_flask" | "unknown";
export type ProjectValidity = "valid" | "warning" | "invalid";

export interface ClassificationResult {
  projectType: ProjectType;
  projectValidity: ProjectValidity;
  validationErrors: string[];
}

/**
 * Classify a project based on its folder structure
 */
export async function classifyProject(projectFolderPath: string): Promise<ClassificationResult> {
  if (!fs.existsSync(projectFolderPath)) {
    return {
      projectType: "unknown",
      projectValidity: "invalid",
      validationErrors: ["Project folder does not exist"],
    };
  }

  const files = listFilesRecursive(projectFolderPath);
  const packageJsonPaths = files.filter(f => path.basename(f) === "package.json");

  // 1. Analyze all package.json files to find the best candidate
  let bestCandidate: { type: ProjectType; score: number; errors: string[] } = { type: "unknown", score: 0, errors: [] };

  for (const pkgPath of packageJsonPaths) {
    const dir = path.dirname(pkgPath);
    const relativeDir = path.relative(projectFolderPath, dir);
    const relativeFiles = files
      .filter(f => f.startsWith(dir))
      .map(f => path.relative(dir, f).replace(/\\/g, "/"));

    const candidate = analyzePackageJsonProject(pkgPath, relativeFiles);
    
    // Prefer root projects or deeper projects if they are clearly better
    // Slight penalty for depth to prefer root if scores are equal
    const depth = relativeDir.split(path.sep).filter(Boolean).length;
    const score = candidate.score - (depth * 0.1); 

    if (score > bestCandidate.score) {
      bestCandidate = { ...candidate, score };
    }
  }

  // 2. If no good package.json candidate, check for other types
  if (bestCandidate.score < 1) {
    const relativePaths = files.map(f => path.relative(projectFolderPath, f).replace(/\\/g, "/"));
    
    const hasIndexHtml = relativePaths.some(p => p === "index.html" || p.includes("public/index.html"));
    const hasRequirementsTxt = relativePaths.some(p => p === "requirements.txt");
    const hasPythonFiles = relativePaths.some(p => p.endsWith(".py"));

    if (hasIndexHtml) {
      return {
        projectType: "static_web",
        projectValidity: "valid",
        validationErrors: [],
      };
    } else if (hasRequirementsTxt && hasPythonFiles) {
      return {
        projectType: "python_flask",
        projectValidity: "valid",
        validationErrors: [],
      };
    } else if (hasRequirementsTxt) {
       return {
        projectType: "python_flask",
        projectValidity: "warning",
        validationErrors: ["Python project with requirements.txt but no .py files found"],
      };
    }
  }

  // 3. Return the best candidate
  if (bestCandidate.type !== "unknown") {
    let validity: ProjectValidity = "valid";
    if (bestCandidate.errors.length > 0) {
      validity = bestCandidate.errors.length <= 2 ? "warning" : "invalid";
    }
    return {
      projectType: bestCandidate.type,
      projectValidity: validity,
      validationErrors: bestCandidate.errors,
    };
  }

  return {
    projectType: "unknown",
    projectValidity: "invalid",
    validationErrors: ["Could not detect project type. No package.json, index.html, or requirements.txt found."],
  };
}

function analyzePackageJsonProject(pkgPath: string, relativeFiles: string[]): { type: ProjectType; score: number; errors: string[] } {
  let pkg: any;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  } catch (e) {
    return { type: "unknown", score: 0, errors: ["Invalid package.json"] };
  }

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const hasReact = "react" in deps;
  const hasNext = "next" in deps;
  const hasAngular = "@angular/core" in deps;
  const hasExpress = "express" in deps;
  const hasVite = "vite" in deps;
  const hasFastify = "fastify" in deps;
  const hasNest = "@nestjs/core" in deps;

  const hasNextConfig = relativeFiles.some(p => p === "next.config.js" || p === "next.config.ts" || p === "next.config.mjs");
  const hasPagesOrApp = relativeFiles.some(p => p.startsWith("pages/") || p.startsWith("app/") || p.startsWith("src/pages/") || p.startsWith("src/app/"));
  const hasSrcIndex = relativeFiles.some(p => p === "src/index.js" || p === "src/index.tsx" || p === "src/main.tsx" || p === "src/main.jsx");
  
  // Expanded server file detection to include index.js/ts in root
  const hasServerFile = relativeFiles.some(p => 
    /^(server\.(js|ts|mjs)|app\.(js|ts|mjs)|main\.(js|ts|mjs)|index\.(js|ts|mjs)|src\/(server|app|main|index)\.(js|ts|mjs))$/.test(p)
  );

  // Next.js
  if (hasNext) {
    const errors = [];
    if (!hasNextConfig && !hasPagesOrApp) {
      errors.push("Next.js project detected but missing next.config.js and pages/app directory");
    }
    return { type: "nextjs", score: 10, errors };
  }

  // Angular
  if (hasAngular) {
    return { type: "angular", score: 9, errors: [] };
  }

  // React SPA (Vite or CRA)
  if (hasReact) {
    const errors = [];
    // Less strict check for src directory, as some projects might be structured differently
    if (!hasSrcIndex && !relativeFiles.some(p => p.includes("src/"))) {
       // It's a warning, not a hard fail if we have react
       // But if it's Vite, we expect index.html
    }
    
    if (hasVite || hasSrcIndex) {
        return { type: "react_spa", score: 8, errors };
    }
    
    // If just React but no Vite/CRA structure clearly found, still likely React
    return { type: "react_spa", score: 7, errors };
  }

  // Node Backend
  if (hasExpress || hasFastify || hasNest || hasServerFile) {
    const errors = [];
    if (!hasServerFile && !hasExpress && !hasFastify && !hasNest) {
      // If no framework and no server file, it's weak
      return { type: "unknown", score: 2, errors: ["package.json found but no server file or framework detected"] };
    }
    
    if (!hasServerFile) {
      // It might be a library or something else, but if it has express, it's likely a backend
      // But if we can't find the entry point, it's a warning
      errors.push("Node backend missing typical entry file (server.js, app.js, main.js, index.js)");
    }
    return { type: "node_backend", score: 6, errors };
  }

  // Generic Node - check scripts
  if (pkg.scripts && (pkg.scripts.start || pkg.scripts.dev || pkg.scripts.build)) {
      // If it has scripts, it's likely a valid node project of some sort
      return { type: "node_backend", score: 4, errors: ["Generic Node.js project detected (based on scripts)"] };
  }

  // Generic Node
  return { type: "unknown", score: 1, errors: ["package.json found but no clear framework detected"] };
}

function listFilesRecursive(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".git") {
        results = results.concat(listFilesRecursive(filePath));
      }
    } else {
      results.push(filePath);
    }
  });
  return results;
}
