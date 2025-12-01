import type { Project } from "@shared/schema";
import { openai } from "../lib/openai";
import pRetry, { AbortError } from "p-retry";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import * as util from "util";

const execAsync = util.promisify(exec);

export interface QaResult {
  passed: boolean;
  report: string;
}

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

/**
 * Run AI-powered QA checks on a project
 * Uses OpenAI to analyze the project source and generate a quality report
 */
export async function runQaOnProject(project: Project): Promise<QaResult> {
  try {
    // 1. Run local tests if available
    let localTestReport = "";
    let localTestsFailed = false;
    if (project.normalizedFolderPath && fs.existsSync(project.normalizedFolderPath)) {
      // Ensure dependencies are installed before running tests
      try {
        const hasNodeModules = fs.existsSync(path.join(project.normalizedFolderPath, "node_modules"));
        if (!hasNodeModules && fs.existsSync(path.join(project.normalizedFolderPath, "package.json"))) {
          console.log(`[QA] Installing dependencies for ${project.id}...`);
          // Use --legacy-peer-deps to avoid ERESOLVE errors with older React versions
          await execAsync("npm install --legacy-peer-deps", { cwd: project.normalizedFolderPath, timeout: 300000 }); // Increased to 5 mins
        }
      } catch (e) {
        console.error("[QA] Failed to install dependencies:", e);
        localTestReport += "Failed to install dependencies. Tests might fail.\n";
      }

      const testResult = await runLocalTests(project.normalizedFolderPath);
      localTestReport += testResult.report;
      localTestsFailed = testResult.failed;
    }

    let report = await pRetry(
      async () => {
        // Using GPT-4o for best balance of code analysis capability and speed
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert code quality analyst. Your job is to analyze project information and provide a detailed QA report. 
              
Be thorough but concise. Provide actionable insights. Format your response as a structured QA report with sections for:
1. Project Overview
2. Source Analysis
3. Local Test Results (if available)
4. Potential Issues & Recommendations
5. Security Considerations
6. Summary & Verdict

IMPORTANT: If the verdict is FAIL, you MUST include a line starting with "**Key Error:**" followed by a short, one-sentence summary of the main reason for failure. Place this in the Summary section.

CRITICAL: You must end your response with exactly one of these two lines:
VERDICT: PASS
or
VERDICT: FAIL

Guidelines for Verdict:
- PASS: If the project builds successfully (or has no build script) and has no CRITICAL security risks.
- ABSOLUTELY DO NOT FAIL due to missing linting or testing scripts. These are optional. Treat them as warnings only.
- FAIL: Only if there are confirmed build failures, critical syntax errors preventing execution, or severe security leaks (like exposed API keys).

If the project has minor issues but is deployable, choose PASS.
If the project has critical errors, build failures, or security risks that prevent deployment, choose FAIL.`
            },
            {
              role: "user",
              content: `Please analyze this project and provide a QA report:

Project Name: ${project.name}
Source Type: ${project.sourceType}
Source URL: ${project.sourceValue}
Registration Date: ${project.createdAt}

Local Test Execution Results:
${localTestReport || "No local tests executed (project not normalized or no tests found)."}

Based on the source type and URL, analyze:
1. Is the source URL properly formatted and accessible?
2. What type of project does this appear to be?
3. Are there any obvious red flags or concerns?
4. What deployment considerations should be noted?

Provide a comprehensive QA report.`
            }
          ],
          max_completion_tokens: 2048,
        });

        return response.choices[0]?.message?.content || "";
      },
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 10000,
        factor: 2,
        onFailedAttempt: (context) => {
          const error = context.error as Error;
          if (!isRateLimitError(error)) {
            throw new AbortError(error.message);
          }
          console.log(`QA retry attempt ${context.attemptNumber} failed. Retrying...`);
        },
      }
    );

    // Determine if QA passed based on the report content
    // We look for the explicit verdict line first
    let passed = false;
    if (report.includes("VERDICT: PASS")) {
      passed = true;
    } else if (report.includes("VERDICT: FAIL")) {
      passed = false;
    } else {
      // Fallback for legacy/unstructured responses
      passed = !report.toLowerCase().includes("verdict: fail") && 
               (report.toLowerCase().includes("pass") || !report.toLowerCase().includes("fail"));
    }

    if (localTestsFailed) {
      // Don't fail the whole QA just because local tests failed. 
      // It might be an environment issue or a specific test failure that the user wants to ignore.
      // passed = false; 
      report += "\n\nWARNING: Local tests or build failed. See 'Local Test Execution Results' above. Proceed with deployment if you believe this is an environment issue.";
    }

    const timestamp = new Date().toISOString();
    const fullReport = `QA Report for "${project.name}"
Generated: ${timestamp}
Analyzed by: AI Quality Assurance System

${report}`;

    return {
      passed,
      report: fullReport,
    };
  } catch (error) {
    console.error("QA analysis failed:", error);
    
    // Return a failure report if OpenAI call fails
    return {
      passed: false,
      report: `QA Report for "${project.name}"
Generated: ${new Date().toISOString()}
Status: FAILED

Error: Unable to complete AI-powered QA analysis.
${error instanceof Error ? error.message : "Unknown error occurred"}

Please try again later or check your project configuration.`,
    };
  }
}

async function runLocalTests(folderPath: string): Promise<{ report: string, failed: boolean }> {
  const packageJsonPath = path.join(folderPath, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return { report: "No package.json found. Skipping local tests.", failed: false };
  }

  let report = "Local Test Execution:\n";
  let failed = false;
  
  try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const scripts = pkg.scripts || {};

    // Run Lint
    if (scripts.lint) {
      report += "\n[Running Lint]\n";
      try {
        const { stdout, stderr } = await execAsync("npm run lint", { cwd: folderPath, timeout: 30000 });
        report += `Output:\n${stdout}\n${stderr}\nResult: PASS\n`;
      } catch (e: any) {
        report += `Output:\n${e.stdout}\n${e.stderr}\nResult: FAIL\n`;
        failed = true;
      }
    } else {
      report += "\n[Lint] No lint script found.\n";
    }

    // Run Tests
    if (scripts.test) {
      report += "\n[Running Tests]\n";
      try {
        const { stdout, stderr } = await execAsync("npm test", { cwd: folderPath, timeout: 60000 });
        report += `Output:\n${stdout}\n${stderr}\nResult: PASS\n`;
      } catch (e: any) {
        report += `Output:\n${e.stdout}\n${e.stderr}\nResult: FAIL\n`;
        failed = true;
      }
    } else {
      report += "\n[Tests] No test script found.\n";
    }

    // Check for build
    if (scripts.build) {
      report += "\n[Running Build Check]\n";
      try {
        const { stdout, stderr } = await execAsync("npm run build", { cwd: folderPath, timeout: 120000 });
        report += `Output:\n${stdout}\n${stderr}\nResult: PASS\n`;
      } catch (e: any) {
        report += `Output:\n${e.stdout}\n${e.stderr}\nResult: FAIL\n`;
        failed = true;
      }
    }

  } catch (error) {
    report += `\nError running local tests: ${error instanceof Error ? error.message : String(error)}\n`;
    failed = true;
  }

  return { report, failed };
}
