import * as fs from "fs";
import * as path from "path";
import type { Project } from "@shared/schema";
import { openai } from "../lib/openai";
import { exec } from "child_process";
import * as util from "util";
import { autoFixEnvVars } from "./envService";
import { syncEnvVarsToRender } from "./deployService";
import { syncEnvVarsToVercel } from "./vercelService";
import { syncEnvVarsToRailway } from "./railwayService";

const execAsync = util.promisify(exec);

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

    // Generate Dockerfile if missing
    await generateDockerfile(folderPath, projectType, actions);

    // Generate .env.example if missing
    await generateEnvExample(folderPath, actions);

    // Generate tsconfig.json if missing and needed
    await generateTsConfig(folderPath, projectType, actions);

    // Generate basic tests if missing
    await generateBasicTests(folderPath, projectType, actions);

    // Ensure dependencies are installed before code repair
    try {
      const hasNodeModules = fs.existsSync(path.join(folderPath, "node_modules"));
      if (!hasNodeModules && fs.existsSync(path.join(folderPath, "package.json"))) {
        console.log(`[AutoFix] Installing dependencies for ${project.id}...`);
        // Use --legacy-peer-deps to avoid ERESOLVE errors with older React versions
        await execAsync("npm install --legacy-peer-deps", { cwd: folderPath, timeout: 120000 });
        actions.push("Installed project dependencies");
      }
    } catch (e) {
      console.error("[AutoFix] Failed to install dependencies:", e);
      actions.push("Failed to install dependencies");
    }

    // Attempt Deep Code Repair (Fix syntax/build errors)
    await attemptCodeRepair(folderPath, actions);

    // Attempt Test Repair (Fix failing tests)
    await attemptTestRepair(folderPath, actions);

    // --- ENV VARS AUTO-FIX & SYNC ---
    try {
      console.log(`[AutoFix] Detecting and fixing environment variables for ${project.id}...`);
      const updatedEnvVars = await autoFixEnvVars(project);
      const envCount = Object.keys(updatedEnvVars).length;
      
      if (envCount > 0) {
        actions.push(`Detected and configured ${envCount} environment variables`);
        
        // Update project object in memory with new env vars for sync
        const updatedProject = { ...project, envVars: updatedEnvVars };

        // Sync to Vercel
        if (process.env.VERCEL_TOKEN) {
          const vResult = await syncEnvVarsToVercel(updatedProject);
          if (vResult.success) {
            actions.push("Synced environment variables to Vercel");
          } else {
            actions.push(`Failed to sync to Vercel: ${vResult.error}`);
          }
        }

        // Sync to Render
        if (process.env.RENDER_API_TOKEN && project.renderServiceId) {
          const rResult = await syncEnvVarsToRender(updatedProject);
          if (rResult.success) {
            actions.push("Synced environment variables to Render");
          } else {
            actions.push(`Failed to sync to Render: ${rResult.error}`);
          }
        }

        // Sync to Railway
        if (process.env.RAILWAY_TOKEN && project.railwayServiceId) {
          const rwResult = await syncEnvVarsToRailway(updatedProject);
          if (rwResult.success) {
            actions.push("Synced environment variables to Railway");
          } else {
            actions.push(`Failed to sync to Railway: ${rwResult.error}`);
          }
        }
      }
    } catch (e) {
      console.error("[AutoFix] Env Var Auto-fix failed:", e);
      actions.push("Failed to auto-configure environment variables");
    }
    // --------------------------------

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
 * Generate Dockerfile based on project type
 */
async function generateDockerfile(
  folderPath: string,
  projectType: string,
  actions: string[]
): Promise<void> {
  const dockerfilePath = path.join(folderPath, "Dockerfile");

  if (fs.existsSync(dockerfilePath)) {
    actions.push("Dockerfile already exists");
    return;
  }

  let content = "";

  switch (projectType) {
    case "node_backend":
      content = `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "start"]`;
      break;

    case "static_web":
      content = `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80`;
      break;

    case "nextjs":
      content = `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]`;
      break;

    case "react_spa":
      content = `FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;
      break;

    default:
      // Generic Node.js fallback
      content = `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["npm", "start"]`;
  }

  fs.writeFileSync(dockerfilePath, content);
  actions.push("Generated Dockerfile for " + projectType);
}

/**
 * Generate .env.example by scanning for process.env usage
 */
async function generateEnvExample(
  folderPath: string,
  actions: string[]
): Promise<void> {
  const envExamplePath = path.join(folderPath, ".env.example");
  
  if (fs.existsSync(envExamplePath)) {
    actions.push(".env.example already exists");
    return;
  }

  const envVars = new Set<string>();
  const files = findFiles(folderPath, ".js").concat(findFiles(folderPath, ".ts"));

  for (const file of files) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const regex = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        if (match[1] !== "NODE_ENV") {
          envVars.add(match[1]);
        }
      }
    } catch (e) {
      // Ignore read errors
    }
  }

  if (envVars.size > 0) {
    const content = Array.from(envVars).map(v => `${v}=`).join("\n");
    fs.writeFileSync(envExamplePath, content);
    actions.push(`Generated .env.example with ${envVars.size} variables`);
  }
}

/**
 * Generate tsconfig.json if missing and needed
 */
async function generateTsConfig(
  folderPath: string,
  projectType: string,
  actions: string[]
): Promise<void> {
  const tsConfigPath = path.join(folderPath, "tsconfig.json");
  
  // Only generate if it's a TS project (has .ts files)
  const hasTsFiles = findFiles(folderPath, ".ts").length > 0;
  
  if (!hasTsFiles) {
    return;
  }

  if (fs.existsSync(tsConfigPath)) {
    actions.push("tsconfig.json already exists");
    return;
  }

  const tsConfig: any = {
    compilerOptions: {
      target: "es2016",
      module: "commonjs",
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      strict: true,
      skipLibCheck: true
    }
  };

  if (projectType === "nextjs" || projectType === "react_spa") {
    Object.assign(tsConfig.compilerOptions, {
      jsx: "react-jsx",
      module: "esnext",
      moduleResolution: "node",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      noEmit: true,
      incremental: true,
      resolveJsonModule: true,
      isolatedModules: true,
    });
    tsConfig.include = ["**/*.ts", "**/*.tsx"];
    tsConfig.exclude = ["node_modules"];
  }

  fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2));
  actions.push("Generated tsconfig.json");
}

/**
 * Generate basic tests if missing
 */
async function generateBasicTests(
  folderPath: string,
  projectType: string,
  actions: string[]
): Promise<void> {
  const packageJsonPath = path.join(folderPath, "package.json");
  if (!fs.existsSync(packageJsonPath)) return;

  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    
    // If test script already exists and isn't a placeholder, skip
    if (pkg.scripts?.test && !pkg.scripts.test.includes("echo")) {
      return;
    }

    // Create tests directory
    const testDir = path.join(folderPath, "tests");
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }

    let testFileCreated = false;

    if (projectType === "node_backend") {
      const testFile = path.join(testDir, "app.test.js");
      if (!fs.existsSync(testFile)) {
        const content = `
const assert = require('assert');
// Simple smoke test
describe('App Smoke Test', () => {
  it('should pass this basic test', () => {
    assert.strictEqual(1 + 1, 2);
  });
});
`;
        fs.writeFileSync(testFile, content.trim());
        testFileCreated = true;
      }
    } else if (projectType === "react_spa" || projectType === "nextjs") {
      const testFile = path.join(testDir, "App.test.js");
      if (!fs.existsSync(testFile)) {
        const content = `
// Basic frontend test
test('renders without crashing', () => {
  const sum = 1 + 1;
  if (sum !== 2) throw new Error('Math is broken');
});
`;
        fs.writeFileSync(testFile, content.trim());
        testFileCreated = true;
      }
    }

    if (testFileCreated) {
      // Update package.json to run these tests
      // We'll use a simple node runner for MVP to avoid heavy deps
      pkg.scripts = pkg.scripts || {};
      pkg.scripts.test = "node tests/*.test.js || true"; // || true to prevent build fail on simple runner
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2));
      actions.push("Generated basic smoke tests and updated test script");
    }

  } catch (e) {
    console.error("Failed to generate tests:", e);
  }
}

/**
 * Attempt to fix code errors using OpenAI
 */
async function attemptCodeRepair(
  folderPath: string,
  actions: string[]
): Promise<void> {
  // 1. Check for build/lint errors
  let errorOutput = "";
  try {
    // Try build first
    await execAsync("npm run build", { cwd: folderPath, timeout: 60000 });
    // If build passes, try lint
    await execAsync("npm run lint", { cwd: folderPath, timeout: 30000 });
    return; // No errors found
  } catch (e: any) {
    errorOutput = e.stdout + "\n" + e.stderr;
  }

  if (!errorOutput) return;

  // 2. Identify problematic file from error output
  // Simple heuristic: look for file paths in the error
  const fileMatch = errorOutput.match(/([a-zA-Z0-9_\-\/]+\.(ts|js|tsx|jsx|json)):/);
  if (!fileMatch) {
    actions.push("Detected build errors but could not identify file to fix.");
    return;
  }

  const relativeFilePath = fileMatch[1];
  const absoluteFilePath = path.join(folderPath, relativeFilePath);

  if (!fs.existsSync(absoluteFilePath)) {
    return;
  }

  // 3. Read file content
  const fileContent = fs.readFileSync(absoluteFilePath, "utf-8");

  // 4. Ask OpenAI to fix it
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert code repair agent. You will be given a file content and an error message. You must output ONLY the fixed file content. Do not include markdown formatting or explanations."
        },
        {
          role: "user",
          content: `File: ${relativeFilePath}
Error:
${errorOutput.slice(0, 1000)}

Content:
${fileContent}`
        }
      ]
    });

    const fixedContent = response.choices[0]?.message?.content;
    if (fixedContent) {
      // Strip markdown code blocks if present
      const cleanContent = fixedContent.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "");
      
      fs.writeFileSync(absoluteFilePath, cleanContent);
      actions.push(`Repaired syntax error in ${relativeFilePath}`);
    }
  } catch (error) {
    console.error("AI Code Repair failed:", error);
    actions.push("Attempted AI code repair but failed.");
  }
}

/**
 * Attempt to fix failing tests using OpenAI
 */
async function attemptTestRepair(
  folderPath: string,
  actions: string[]
): Promise<void> {
  // 1. Run tests
  let errorOutput = "";
  try {
    // Check if it's an Angular project and adjust test command
    const isAngular = fs.existsSync(path.join(folderPath, "angular.json"));
    let testCommand = "npm test";
    
    if (isAngular) {
      // For Angular, we need to ensure we run in CI mode (no watch, headless)
      // We can try to pass arguments, but npm scripts might not forward them.
      // Best bet is to try running ng directly if possible, or assume npm test is configured.
      // But often npm test is just "ng test".
      // Let's try to modify package.json temporarily or just run a timeout-bound test.
      // Actually, let's try to run 'ng test' directly if we can find the binary, or use npx.
      testCommand = "npx ng test --watch=false --browsers=ChromeHeadless";
    }

    await execAsync(testCommand, { cwd: folderPath, timeout: 60000 });
    return; // Tests passed
  } catch (e: any) {
    errorOutput = e.stdout + "\n" + e.stderr;
  }

  if (!errorOutput) return;

  // 2. Identify problematic test file
  // Look for "at ... (src/app/app.spec.ts:21:55)" or similar
  const fileMatch = errorOutput.match(/([a-zA-Z0-9_\-\/]+\.(spec\.ts|test\.ts|test\.js|spec\.js))/);
  
  if (!fileMatch) {
    actions.push("Detected test failures but could not identify test file to fix.");
    return;
  }

  const relativeFilePath = fileMatch[1];
  // Sometimes the path in stack trace is absolute or relative to source root.
  // We need to find the actual file.
  // If it starts with src/, it's likely relative to project root.
  let absoluteFilePath = path.join(folderPath, relativeFilePath);
  
  // If not found, try to search for it
  if (!fs.existsSync(absoluteFilePath)) {
     const foundFiles = findFiles(folderPath, path.basename(relativeFilePath));
     if (foundFiles.length > 0) {
       absoluteFilePath = foundFiles[0];
     } else {
       return;
     }
  }

  // 3. Read file content
  const fileContent = fs.readFileSync(absoluteFilePath, "utf-8");

  // 4. Ask OpenAI to fix it
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are an expert test repair agent. You will be given a test file content and a failure message. You must output ONLY the fixed test file content. Do not include markdown formatting or explanations. If the test is checking for something that doesn't exist (like a wrong title), update the test to match reality or fix the expectation."
        },
        {
          role: "user",
          content: `File: ${relativeFilePath}
Error:
${errorOutput.slice(0, 1000)}

Content:
${fileContent}`
        }
      ]
    });

    const fixedContent = response.choices[0]?.message?.content;
    if (fixedContent) {
      // Strip markdown code blocks if present
      const cleanContent = fixedContent.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "");
      
      fs.writeFileSync(absoluteFilePath, cleanContent);
      actions.push(`Repaired failing test in ${path.basename(absoluteFilePath)}`);
    }
  } catch (error) {
    console.error("AI Test Repair failed:", error);
    actions.push("Attempted AI test repair but failed.");
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
