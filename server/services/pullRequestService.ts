import * as fs from "fs";
import * as path from "path";
import type { Project, PullRequest } from "@shared/schema";

export interface FileDiff {
  file: string;
  change: "added" | "removed" | "modified";
  before?: string;
  after?: string;
}

export interface CreatePRResult {
  pr: PullRequest;
  diffs: FileDiff[];
}

/**
 * Create an auto pull request comparing two folder versions
 */
export async function createAutoPullRequest(
  project: Project,
  normalizedFolderPath: string,
  updatedFolderPath: string,
  actionsLog: string[]
): Promise<CreatePRResult> {
  // Generate PR number
  const prNumber = (project.lastPrNumber || 0) + 1;

  // Generate diffs
  const diffs = await generateDiffs(normalizedFolderPath, updatedFolderPath);

  // Build PR object
  const pr: PullRequest = {
    id: generateUUID(),
    projectId: project.id,
    prNumber,
    title: `Auto-Fix Update (PR #${prNumber})`,
    description: actionsLog.join("\n"),
    createdAt: new Date(),
    status: "merged", // Auto-merge for MVP
    diffJson: diffs,
    patchFolderPath: updatedFolderPath,
  };

  return { pr, diffs };
}

/**
 * Merge a pull request by applying changes to normalized folder
 */
export async function mergePullRequest(
  pr: PullRequest,
  normalizedFolderPath: string
): Promise<void> {
  if (!pr.patchFolderPath) {
    throw new Error("No patch folder path in PR");
  }

  // Copy updated files into normalized folder
  copyDirContents(pr.patchFolderPath, normalizedFolderPath);

  // Handle removed files
  const diffs = pr.diffJson as FileDiff[];
  for (const diff of diffs) {
    if (diff.change === "removed") {
      const filePath = path.join(normalizedFolderPath, diff.file);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        // Ignore
      }
    }
  }
}

/**
 * Close a pull request without merging
 */
export async function closePullRequest(pr: PullRequest): Promise<void> {
  // Just mark as closed - no file operations
  pr.status = "closed";
}

/**
 * Generate diffs between two folder versions
 */
async function generateDiffs(oldPath: string, newPath: string): Promise<FileDiff[]> {
  const diffs: FileDiff[] = [];
  const processedFiles = new Set<string>();

  try {
    // Find all files in old path
    const oldFiles = listAllFiles(oldPath);
    const newFiles = listAllFiles(newPath);

    // Check for removed and modified files
    for (const file of oldFiles) {
      processedFiles.add(file);
      const oldFilePath = path.join(oldPath, file);
      const newFilePath = path.join(newPath, file);

      if (!fs.existsSync(newFilePath)) {
        diffs.push({
          file,
          change: "removed",
          before: readFileContent(oldFilePath),
        });
      } else {
        const oldContent = readFileContent(oldFilePath);
        const newContent = readFileContent(newFilePath);

        if (oldContent !== newContent) {
          diffs.push({
            file,
            change: "modified",
            before: oldContent,
            after: newContent,
          });
        }
      }
    }

    // Check for added files
    for (const file of newFiles) {
      if (!processedFiles.has(file)) {
        const newFilePath = path.join(newPath, file);
        diffs.push({
          file,
          change: "added",
          after: readFileContent(newFilePath),
        });
      }
    }
  } catch (e) {
    console.error("Error generating diffs:", e);
  }

  return diffs;
}

/**
 * List all files recursively
 */
function listAllFiles(dir: string, prefix = ""): string[] {
  const files: string[] = [];

  try {
    const items = fs.readdirSync(dir);
    items.forEach(item => {
      const itemPath = path.join(dir, item);
      const relativePath = prefix ? `${prefix}/${item}` : item;

      try {
        const stat = fs.statSync(itemPath);
        if (stat.isDirectory() && !["node_modules", ".git", ".next"].includes(item)) {
          files.push(...listAllFiles(itemPath, relativePath));
        } else if (stat.isFile()) {
          files.push(relativePath);
        }
      } catch (e) {
        // Ignore
      }
    });
  } catch (e) {
    // Ignore
  }

  return files;
}

/**
 * Read file content safely
 */
function readFileContent(filePath: string): string {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 1024 * 100) {
      // >100KB
      return "[Binary or large file - not shown]";
    }
    return fs.readFileSync(filePath, "utf-8");
  } catch (e) {
    return "[Could not read file]";
  }
}

/**
 * Copy directory contents
 */
function copyDirContents(src: string, dest: string): void {
  try {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const items = fs.readdirSync(src);
    items.forEach(item => {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);

      try {
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
          if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
          }
          copyDirContents(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      } catch (e) {
        // Ignore
      }
    });
  } catch (e) {
    // Ignore
  }
}

/**
 * Generate UUID
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
