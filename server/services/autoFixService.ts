import * as fs from "fs";
import * as path from "path";
import type { Project } from "@shared/schema";

export interface AutoFixResult {
  autoFixStatus: "success" | "failed";
  autoFixReport: string;
  readyForDeploy: boolean;
}

/**
 * Automatically fix common project issues
 */
export async function autoFixProject(project: Project): Promise<AutoFixResult> {
  const actions: string[] = [];

  if (!project.normalizedFolderPath) {
    return {
      autoFixStatus: "failed",
      autoFixReport: "No normalized folder path found. Run normalization first.",
      readyForDeploy: false,
    };
  }

  const folderPath = project.normalizedFolderPath;

  if (!fs.existsSync(folderPath)) {
    return {
      autoFixStatus: "failed",
      autoFixReport: `Normalized folder does not exist: ${folderPath}`,
      readyForDeploy: false,
    };
  }

  try {
    const projectType = project.projectType || "unknown";

    switch (projectType) {
      case "static_web":
        await fixStaticWeb(folderPath, actions);
        break;
      case "node_backend":
        await fixNodeBackend(folderPath, project.name, actions);
        break;
      case "nextjs":
      case "react_spa":
        await fixReactProject(folderPath, projectType, actions);
        break;
      default:
        actions.push("No specific auto-fixes available for this project type.");
    }

    // Determine if ready for deploy
    const readyForDeploy = checkReadyForDeploy(projectType, folderPath);

    const report = buildAutoFixReport(projectType, actions, readyForDeploy);

    return {
      autoFixStatus: "success",
      autoFixReport: report,
      readyForDeploy,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error(`[AutoFix] Error fixing project ${project.id}:`, error);

    return {
      autoFixStatus: "failed",
      autoFixReport: `Auto-fix failed: ${errorMsg}`,
      readyForDeploy: false,
    };
  }
}

/**
 * Fix static web projects
 */
async function fixStaticWeb(folderPath: string, actions: string[]): Promise<void> {
  const indexPath = path.join(folderPath, "index.html");

  // Check if index.html exists
  if (!fs.existsSync(indexPath)) {
    // Look for other HTML files
    const htmlFiles = findFiles(folderPath, ".html");
    const candidateFiles = htmlFiles.filter(f => 
      f.includes("main.html") || f.includes("home.html") || f.includes("index.html")
    );

    if (candidateFiles.length > 0) {
      // Copy first candidate to index.html
      fs.copyFileSync(candidateFiles[0], indexPath);
      actions.push(`Created index.html from ${path.basename(candidateFiles[0])}`);
    } else if (htmlFiles.length > 0) {
      // Use first HTML file
      fs.copyFileSync(htmlFiles[0], indexPath);
      actions.push(`Created index.html from ${path.basename(htmlFiles[0])}`);
    } else {
      // Create placeholder
      const placeholder = `<!DOCTYPE html>
<html>
<head>
  <title>AI Deploy Mentor</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; text-align: center; }
  </style>
</head>
<body>
  <h1>Welcome to AI Deploy Mentor</h1>
  <p>This is a placeholder page. Replace with your actual content.</p>
</body>
</html>`;
      fs.writeFileSync(indexPath, placeholder);
      actions.push("Created placeholder index.html");
    }
  } else {
    actions.push("index.html already exists");
  }
}

/**
 * Fix Node.js backend projects
 */
async function fixNodeBackend(
  folderPath: string,
  projectName: string,
  actions: string[]
): Promise<void> {
  const packageJsonPath = path.join(folderPath, "package.json");

  // Check if package.json exists
  if (!fs.existsSync(packageJsonPath)) {
    // Create minimal package.json
    const pkg = {
      name: projectName.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      version: "1.0.0",
      main: "server.js",
      scripts: {
        start: "node server.js",
      },
      dependencies: {
        express: "^4.18.0",
      },
    };
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
    actions.push("Created minimal package.json");
  } else {
    // Check and update package.json
    try {
      const content = fs.readFileSync(packageJsonPath, "utf-8");
      const pkg = JSON.parse(content);

      if (!pkg.scripts) {
        pkg.scripts = {};
      }

      if (!pkg.scripts.start) {
        pkg.scripts.start = "node server.js";
        fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
        actions.push("Added start script to package.json");
      } else {
        actions.push("package.json already has start script");
      }
    } catch (e) {
      actions.push("Could not parse package.json, skipping updates");
    }
  }

  // Check for entry file
  const entryFiles = ["server.js", "app.js", "index.js", "main.js"];
  const entryExists = entryFiles.some(f => fs.existsSync(path.join(folderPath, f)));

  if (!entryExists) {
    // Create placeholder server.js
    const serverCode = `const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.send('Hello from AI Deploy Mentor Node backend!');
});

app.listen(port, () => {
  console.log('Server is running on port', port);
});`;

    fs.writeFileSync(path.join(folderPath, "server.js"), serverCode);
    actions.push("Created placeholder server.js");
  } else {
    actions.push("Entry point file detected");
  }
}

/**
 * Fix React/Next.js projects
 */
async function fixReactProject(
  folderPath: string,
  projectType: string,
  actions: string[]
): Promise<void> {
  const packageJsonPath = path.join(folderPath, "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    actions.push("No package.json found, skipping script fixes");
    return;
  }

  try {
    const content = fs.readFileSync(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content);

    if (!pkg.scripts) {
      pkg.scripts = {};
    }

    let updated = false;

    if (projectType === "nextjs") {
      const nextScripts = {
        dev: "next dev",
        build: "next build",
        start: "next start",
      };

      for (const [key, value] of Object.entries(nextScripts)) {
        if (!pkg.scripts[key]) {
          pkg.scripts[key] = value;
          updated = true;
        }
      }

      if (updated) {
        fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
        actions.push("Added Next.js build scripts");
      }
    } else if (projectType === "react_spa") {
      if (!pkg.scripts.start) {
        // Try to detect if using Vite
        if (Object.keys(pkg.dependencies || {}).includes("vite")) {
          pkg.scripts.start = "vite";
          pkg.scripts.build = "vite build";
        } else {
          pkg.scripts.start = "react-scripts start";
          pkg.scripts.build = "react-scripts build";
        }
        updated = true;
      }

      if (updated) {
        fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
        actions.push("Added React build scripts");
      }
    }

    if (!updated) {
      actions.push("Build scripts already configured");
    }
  } catch (e) {
    actions.push("Could not update package.json scripts");
  }
}

/**
 * Check if project is ready for deployment
 */
function checkReadyForDeploy(projectType: string, folderPath: string): boolean {
  switch (projectType) {
    case "static_web":
      return fs.existsSync(path.join(folderPath, "index.html"));
    case "node_backend":
      return (
        fs.existsSync(path.join(folderPath, "package.json")) &&
        (fs.existsSync(path.join(folderPath, "server.js")) ||
          fs.existsSync(path.join(folderPath, "app.js")) ||
          fs.existsSync(path.join(folderPath, "index.js")))
      );
    case "nextjs":
    case "react_spa":
      return fs.existsSync(path.join(folderPath, "package.json"));
    default:
      return false;
  }
}

/**
 * Build auto-fix report
 */
function buildAutoFixReport(
  projectType: string,
  actions: string[],
  readyForDeploy: boolean
): string {
  let report = `Auto-fix Report
===============

Project type: ${projectType}

Actions taken:
`;

  actions.forEach(action => {
    report += `  • ${action}\n`;
  });

  report += `\nResult: Project is ${readyForDeploy ? "ready" : "NOT ready"} for deployment.`;

  return report;
}

/**
 * Find files with given extension
 */
function findFiles(dir: string, ext: string): string[] {
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
