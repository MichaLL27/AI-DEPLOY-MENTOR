import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import type { Project } from "@shared/schema";

export interface NormalizationResult {
  normalizedStatus: "success" | "failed";
  normalizedFolderPath: string | null;
  normalizedReport: string;
  readyForDeploy: boolean;
}

/**
 * Normalize project structure based on detected project type
 */
export async function normalizeProjectStructure(
  project: Project,
  extractedFolderPath: string
): Promise<NormalizationResult> {
  const actions: string[] = [];
  const isVercel = process.env.VERCEL === "1";
  const isRender = process.env.RENDER === "true";
  let normalizedRoot = (isVercel || isRender)
    ? path.join(os.tmpdir(), "normalized", project.id)
    : path.join(process.cwd(), "normalized", project.id);

  try {
    // Clean and ensure normalized directory
    if (fs.existsSync(normalizedRoot)) {
      // Retry logic for Windows EBUSY errors
      let deleted = false;
      for (let i = 0; i < 5; i++) {
        try {
          fs.rmSync(normalizedRoot, { recursive: true, force: true });
          deleted = true;
          break;
        } catch (e: any) {
          if (e.code === 'EBUSY' || e.code === 'EPERM') {
            console.log(`[Normalizer] Folder locked, retrying delete (${i+1}/5)...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            // If it's not a lock error, maybe we can't delete it for other reasons
            // But we'll try the fallback anyway
            break; 
          }
        }
      }
      
      if (!deleted) {
        // If we still can't delete, use a unique path for this run
        // This avoids the lock entirely
        console.warn(`[Normalizer] Could not clean ${normalizedRoot}, switching to unique path.`);
        const timestamp = Date.now();
        normalizedRoot = (isVercel || isRender)
          ? path.join(os.tmpdir(), "normalized", `${project.id}_${timestamp}`)
          : path.join(process.cwd(), "normalized", `${project.id}_${timestamp}`);
          
        actions.push(`Original folder was locked. Created new normalized instance at: ${path.basename(normalizedRoot)}`);
      }
    }
    fs.mkdirSync(normalizedRoot, { recursive: true });

    const projectType = project.projectType || "unknown";

    switch (projectType) {
      case "static_web":
        await normalizeStaticWeb(extractedFolderPath, normalizedRoot, actions);
        break;
      case "node_backend":
        await normalizeNodeBackend(extractedFolderPath, normalizedRoot, actions);
        break;
      case "nextjs":
      case "react_spa":
        await normalizeReactProject(extractedFolderPath, normalizedRoot, actions, projectType);
        break;
      case "python_flask":
        await normalizePython(extractedFolderPath, normalizedRoot, actions);
        break;
      default:
        await normalizeSafeCleanup(extractedFolderPath, normalizedRoot, actions);
    }

    // Remove junk files from normalized root
    await removeJunkFiles(normalizedRoot, actions);

    // Determine if ready for deploy
    const readyForDeploy = isProjectReadyForDeploy(projectType, normalizedRoot);

    // Build report
    const report = buildNormalizationReport(project.id, projectType, actions, readyForDeploy);

    return {
      normalizedStatus: "success",
      normalizedFolderPath: normalizedRoot,
      normalizedReport: report,
      readyForDeploy,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[Normalizer] CRITICAL ERROR normalizing project ${project.id}:`, error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }

    return {
      normalizedStatus: "failed",
      normalizedFolderPath: null,
      normalizedReport: `Normalization failed: ${errorMsg}`,
      readyForDeploy: false,
    };
  }
}

/**
 * Normalize static web site - find and promote index.html
 */
async function normalizeStaticWeb(
  source: string,
  dest: string,
  actions: string[]
): Promise<void> {
  const indexHtmlPath = findFile(source, "index.html");

  if (indexHtmlPath) {
    const parentDir = path.dirname(indexHtmlPath);
    if (parentDir !== source) {
      // index.html is in a subdirectory
      actions.push(`Moved static site from ${path.relative(source, parentDir)} to normalized root.`);
      copyDirContents(parentDir, dest);
    } else {
      // index.html is already in root
      copyDirContents(source, dest);
    }
  } else {
    // No index.html found, just copy everything
    actions.push("No index.html found, copying all contents.");
    copyDirContents(source, dest);
  }
}

/**
 * Normalize Node.js backend
 */
async function normalizeNodeBackend(
  source: string,
  dest: string,
  actions: string[]
): Promise<void> {
  // Find package.json that has express or is near server.js
  const packageJsonPath = findPackageJsonWithDependency(source, "express") || findFile(source, "package.json");

  if (packageJsonPath) {
    const parentDir = path.dirname(packageJsonPath);
    if (parentDir !== source) {
      actions.push(`Moved backend from ${path.relative(source, parentDir)} to normalized root.`);
    }
    copyDirContents(parentDir, dest);
  } else {
    copyDirContents(source, dest);
  }

  // Find and log entry point
  const entryPoints = ["server.js", "server.ts", "app.js", "app.ts", "main.js", "main.ts", "index.js"];
  for (const entry of entryPoints) {
    if (fs.existsSync(path.join(dest, entry))) {
      actions.push(`Detected entry file: ${entry}`);
      break;
    }
    if (fs.existsSync(path.join(dest, "src", entry))) {
      actions.push(`Detected entry file: src/${entry}`);
      break;
    }
  }

  actions.push("Removed node_modules and cache directories.");
}

/**
 * Normalize React or Next.js project
 */
async function normalizeReactProject(
  source: string,
  dest: string,
  actions: string[],
  projectType: string
): Promise<void> {
  // Find package.json that has react/next
  const packageJsonPath = findPackageJsonWithDependency(source, projectType === "nextjs" ? "next" : "react") || findFile(source, "package.json");

  if (packageJsonPath) {
    const parentDir = path.dirname(packageJsonPath);
    if (parentDir !== source) {
      actions.push(`Moved ${projectType} project from ${path.relative(source, parentDir)} to normalized root.`);
    }
    copyDirContents(parentDir, dest);
  } else {
    copyDirContents(source, dest);
  }

  // Check for build output
  const buildDirs = ["out", "build", "dist", ".next"];
  for (const dir of buildDirs) {
    if (fs.existsSync(path.join(dest, dir))) {
      actions.push(`Found build output directory: ${dir} (will be regenerated during deployment)`);
      break;
    }
  }

  actions.push("Ensured src and public folders are in normalized root.");
}

/**
 * Find a package.json that contains a specific dependency
 */
function findPackageJsonWithDependency(dir: string, dependency: string): string | null {
  try {
    const items = fs.readdirSync(dir);
    
    // Check current directory first
    if (items.includes("package.json")) {
      const pkgPath = path.join(dir, "package.json");
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (dependency in deps) {
          return pkgPath;
        }
      } catch (e) {
        // Ignore invalid package.json
      }
    }

    // Recurse into subdirectories
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory() && !["node_modules", ".git", "dist", "build"].includes(item)) {
        const found = findPackageJsonWithDependency(itemPath, dependency);
        if (found) return found;
      }
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

/**
 * Normalize Python Flask project
 */
async function normalizePython(
  source: string,
  dest: string,
  actions: string[]
): Promise<void> {
  const requirementsPath = findFile(source, "requirements.txt");
  const parentDir = requirementsPath ? path.dirname(requirementsPath) : source;

  copyDirContents(parentDir, dest);

  // Find main Python file
  const pyFiles = findFilesWithExtension(dest, ".py");
  if (pyFiles.length > 0) {
    const mainFile = pyFiles.find(f => 
      f.endsWith("app.py") || f.endsWith("main.py") || f.endsWith("server.py")
    ) || pyFiles[0];
    actions.push(`Detected main Python file: ${path.basename(mainFile)}`);
  }

  actions.push("Removed __pycache__ and .venv directories.");
}

/**
 * Safe cleanup for unknown types
 */
async function normalizeSafeCleanup(
  source: string,
  dest: string,
  actions: string[]
): Promise<void> {
  copyDirContents(source, dest);
  actions.push("Applied safe cleanup only (unknown project type).");
  actions.push("Removed obvious junk files (.DS_Store, __MACOSX, .git).");
}

/**
 * Remove junk files from directory
 */
async function removeJunkFiles(dir: string, actions: string[]): Promise<void> {
  const junkPatterns = [
    ".git",
    ".gitignore",
    ".DS_Store",
    "__MACOSX",
    ".cache",
    ".venv",
    "__pycache__",
    "*.log",
    "*.tmp",
    "Thumbs.db",
    ".env.local",
  ];

  // Only remove node_modules if NOT on Render
  // On Render, we want to keep uploaded node_modules to speed up install
  if (process.env.RENDER !== "true") {
    junkPatterns.push("node_modules");
  } else {
    actions.push("Preserved node_modules (if present) to speed up Render deployment.");
  }

  const filesToRemove: string[] = [];

  try {
    const walk = (current: string) => {
      try {
        const items = fs.readdirSync(current);
        items.forEach(item => {
          const itemPath = path.join(current, item);
          if (junkPatterns.includes(item) || junkPatterns.some(p => item.match(p))) {
            try {
              const stat = fs.statSync(itemPath);
              if (stat.isDirectory()) {
                fs.rmSync(itemPath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(itemPath);
              }
              filesToRemove.push(item);
            } catch (e) {
              // Ignore
            }
          } else if (fs.statSync(itemPath).isDirectory()) {
            walk(itemPath);
          }
        });
      } catch (e) {
        // Ignore
      }
    };

    walk(dir);

    if (filesToRemove.length > 0) {
      actions.push(`Removed ${filesToRemove.length} junk files/folders.`);
    }
  } catch (e) {
    // Safe to ignore cleanup errors
  }
}

/**
 * Determine if project is ready for deployment
 */
function isProjectReadyForDeploy(projectType: string, normalizedRoot: string): boolean {
  if (projectType === "unknown") return false;

  switch (projectType) {
    case "static_web":
      return fs.existsSync(path.join(normalizedRoot, "index.html"));
    case "node_backend":
      return fs.existsSync(path.join(normalizedRoot, "package.json"));
    case "nextjs":
    case "react_spa":
    case "angular":
      return fs.existsSync(path.join(normalizedRoot, "package.json"));
    case "python_flask":
      return fs.existsSync(path.join(normalizedRoot, "requirements.txt"));
    default:
      return false;
  }
}

/**
 * Build human-readable normalization report
 */
function buildNormalizationReport(
  projectId: string,
  projectType: string,
  actions: string[],
  readyForDeploy: boolean
): string {
  let report = `Normalization Report for project ${projectId}:
================================

Detected type: ${projectType}

Actions taken:
`;

  actions.forEach(action => {
    report += `  • ${action}\n`;
  });

  report += `\nResult: Project is ${readyForDeploy ? "ready" : "NOT ready"} for deployment.`;

  if (!readyForDeploy && projectType !== "unknown") {
    report += "\nCheck the normalization steps above for missing files.";
  }

  return report;
}

/**
 * Find a file recursively
 */
function findFile(dir: string, filename: string): string | null {
  try {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const itemPath = path.join(dir, item);
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory() && !["node_modules", ".git", "dist", "build"].includes(item)) {
        if (item === filename) return itemPath;
        const found = findFile(itemPath, filename);
        if (found) return found;
      } else if (item === filename) {
        return itemPath;
      }
    }
  } catch (e) {
    // Ignore
  }
  return null;
}

/**
 * Find files with given extension
 */
function findFilesWithExtension(dir: string, ext: string): string[] {
  const files: string[] = [];

  try {
    const walk = (current: string) => {
      const items = fs.readdirSync(current);
      items.forEach(item => {
        const itemPath = path.join(current, item);
        try {
          const stat = fs.statSync(itemPath);
          if (stat.isDirectory() && !["node_modules", ".git"].includes(item)) {
            walk(itemPath);
          } else if (item.endsWith(ext)) {
            files.push(itemPath);
          }
        } catch (e) {
          // Ignore
        }
      });
    };

    walk(dir);
  } catch (e) {
    // Ignore
  }

  return files;
}

/**
 * Copy directory contents
 */
function copyDirContents(src: string, dest: string): void {
  try {
    const items = fs.readdirSync(src);
    items.forEach(item => {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);

      try {
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
          fs.mkdirSync(destPath, { recursive: true });
          copyDirContents(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      } catch (e) {
        // Ignore copy errors
      }
    });
  } catch (e) {
    // Ignore
  }
}
