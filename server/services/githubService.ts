import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { exec } from "child_process";
import * as util from "util";
import AdmZip from "adm-zip";

const execAsync = util.promisify(exec);

export async function cloneAndZipRepository(
  repoUrl: string,
  projectId: string
): Promise<string> {
  const isVercel = process.env.VERCEL === "1";
  const baseDir = isVercel ? os.tmpdir() : process.cwd();
  const cloneDir = path.join(baseDir, "tmp", "github-clones", projectId);
  const zipPath = path.join(baseDir, "uploads", "projects", projectId, "source.zip");

  // Ensure directories exist
  fs.mkdirSync(path.dirname(cloneDir), { recursive: true });
  fs.mkdirSync(path.dirname(zipPath), { recursive: true });

  try {
    console.log(`Cloning ${repoUrl} to ${cloneDir}...`);
    
    // Clone the repository
    // Using --depth 1 for faster clone
    await execAsync(`git clone --depth 1 ${repoUrl} "${cloneDir}"`);

    // Remove .git directory to keep it clean
    const gitDir = path.join(cloneDir, ".git");
    if (fs.existsSync(gitDir)) {
      fs.rmSync(gitDir, { recursive: true, force: true });
    }

    console.log(`Zipping cloned repository to ${zipPath}...`);
    
    // Create ZIP from cloned folder
    const zip = new AdmZip();
    zip.addLocalFolder(cloneDir);
    zip.writeZip(zipPath);

    // Cleanup clone directory
    fs.rmSync(cloneDir, { recursive: true, force: true });

    return zipPath;
  } catch (error) {
    // Cleanup on error
    try {
      if (fs.existsSync(cloneDir)) {
        fs.rmSync(cloneDir, { recursive: true, force: true });
      }
    } catch {}
    
    throw error;
  }
}
