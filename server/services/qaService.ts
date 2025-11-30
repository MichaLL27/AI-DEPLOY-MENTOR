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
    if (project.normalizedFolderPath && fs.existsSync(project.normalizedFolderPath)) {
      localTestReport = await runLocalTests(project.normalizedFolderPath);
    }

    const report = await pRetry(
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

Always end with a clear PASS or FAIL verdict based on your analysis.`
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
    const passed = !report.toLowerCase().includes("fail") || 
                   report.toLowerCase().includes("pass");

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

async function runLocalTests(folderPath: string): Promise<string> {
  const packageJsonPath = path.join(folderPath, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return "No package.json found. Skipping local tests.";
  }

  let report = "Local Test Execution:\n";
  
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
      }
    }

  } catch (error) {
    report += `\nError running local tests: ${error instanceof Error ? error.message : String(error)}\n`;
  }

  return report;
}
