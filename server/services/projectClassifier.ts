import * as fs from "fs";
import * as path from "path";

export type ProjectType = "static_web" | "node_backend" | "nextjs" | "react_spa" | "python_flask" | "unknown";
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
  const relativePaths = files.map(f => path.relative(projectFolderPath, f).replace(/\\/g, "/"));

  // Detect file markers
  const hasPackageJson = relativePaths.some(p => p === "package.json" || p.endsWith("/package.json"));
  const hasNextConfig = relativePaths.some(p => p === "next.config.js" || p === "next.config.ts" || p === "next.config.mjs");
  const hasIndexHtml = relativePaths.some(p => p === "index.html" || p.includes("public/index.html"));
  const hasRequirementsTxt = relativePaths.some(p => p === "requirements.txt");
  const hasPythonFiles = relativePaths.some(p => p.endsWith(".py"));
  const hasServerFile = relativePaths.some(p => 
    /^(server\.(js|ts|mjs)|app\.(js|ts|mjs)|main\.(js|ts|mjs)|src\/(server|app|main|index)\.(js|ts|mjs))$/.test(p)
  );
  const hasSrcIndex = relativePaths.some(p => p === "src/index.js" || p === "src/index.tsx");
  const hasReactDep = hasPackageJson && checkReactInDependencies(projectFolderPath);
  const hasExpressDep = hasPackageJson && checkExpressInDependencies(projectFolderPath);
  const hasNextDep = hasPackageJson && checkNextInDependencies(projectFolderPath);

  const errors: string[] = [];
  let projectType: ProjectType = "unknown";

  // Classify based on detected markers
  if (hasPackageJson && hasNextDep) {
    projectType = "nextjs";
    // Validate
    if (!hasNextConfig && !relativePaths.some(p => p.includes("pages/") || p.includes("app/"))) {
      errors.push("Next.js project detected but missing next.config.js and pages/app directory");
    }
  } else if (hasPackageJson && hasReactDep && hasSrcIndex) {
    projectType = "react_spa";
    // Validate
    if (!relativePaths.some(p => p.includes("src/"))) {
      errors.push("React SPA missing src directory");
    }
  } else if (hasPackageJson && (hasServerFile || hasExpressDep)) {
    projectType = "node_backend";
    // Validate
    if (!hasServerFile) {
      errors.push("Node backend missing typical entry file (server.js, app.js, main.js)");
    }
  } else if (hasPackageJson && !hasServerFile && !hasExpressDep) {
    projectType = "unknown";
    errors.push("package.json found but no clear backend or frontend markers");
  } else if (hasIndexHtml) {
    projectType = "static_web";
    // Validate - static web needs index.html
  } else if (hasRequirementsTxt && hasPythonFiles) {
    projectType = "python_flask";
    // Validate
    if (!hasPythonFiles) {
      errors.push("Python project with requirements.txt but no .py files found");
    }
  }

  // Validate structure based on type
  if (projectType === "static_web" && !hasIndexHtml) {
    errors.push("Static web project must contain index.html");
    projectType = "unknown";
  } else if (projectType === "node_backend" && !hasPackageJson) {
    errors.push("Node backend must contain package.json");
    projectType = "unknown";
  } else if (projectType === "nextjs" && !hasPackageJson) {
    errors.push("Next.js project must contain package.json");
    projectType = "unknown";
  } else if (projectType === "python_flask" && !hasRequirementsTxt) {
    errors.push("Python project should contain requirements.txt");
  }

  // Determine validity
  let projectValidity: ProjectValidity = "valid";
  if (errors.length > 0) {
    projectValidity = errors.length <= 2 ? "warning" : "invalid";
  }

  return {
    projectType,
    projectValidity,
    validationErrors: errors,
  };
}

/**
 * List all files recursively in a directory
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
            // Skip node_modules and common ignore dirs
            if (item !== "node_modules" && item !== ".git" && item !== "dist" && item !== "build" && !item.startsWith(".")) {
              walk(itemPath);
            }
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

/**
 * Check if react is in dependencies
 */
function checkReactInDependencies(projectFolderPath: string): boolean {
  try {
    const packageJsonPath = path.join(projectFolderPath, "package.json");
    if (!fs.existsSync(packageJsonPath)) return false;

    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return "react" in deps;
  } catch {
    return false;
  }
}

/**
 * Check if express is in dependencies
 */
function checkExpressInDependencies(projectFolderPath: string): boolean {
  try {
    const packageJsonPath = path.join(projectFolderPath, "package.json");
    if (!fs.existsSync(packageJsonPath)) return false;

    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return "express" in deps;
  } catch {
    return false;
  }
}

/**
 * Check if next is in dependencies
 */
function checkNextInDependencies(projectFolderPath: string): boolean {
  try {
    const packageJsonPath = path.join(projectFolderPath, "package.json");
    if (!fs.existsSync(packageJsonPath)) return false;

    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    return "next" in deps;
  } catch {
    return false;
  }
}
