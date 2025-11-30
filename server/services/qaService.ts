import type { Project } from "@shared/schema";
import OpenAI from "openai";
import pRetry, { AbortError } from "p-retry";

// This is using Replit's AI Integrations service, which provides OpenAI-compatible API access
// without requiring your own OpenAI API key. Charges are billed to your Replit credits.
const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

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
    const report = await pRetry(
      async () => {
        // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        const response = await openai.chat.completions.create({
          model: "gpt-5",
          messages: [
            {
              role: "system",
              content: `You are an expert code quality analyst. Your job is to analyze project information and provide a detailed QA report. 
              
Be thorough but concise. Provide actionable insights. Format your response as a structured QA report with sections for:
1. Project Overview
2. Source Analysis
3. Potential Issues & Recommendations
4. Security Considerations
5. Summary & Verdict

Always end with a clear PASS or FAIL verdict based on your analysis.`
            },
            {
              role: "user",
              content: `Please analyze this project and provide a QA report:

Project Name: ${project.name}
Source Type: ${project.sourceType}
Source URL: ${project.sourceValue}
Registration Date: ${project.createdAt}

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
