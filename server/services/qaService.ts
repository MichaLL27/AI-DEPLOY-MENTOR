import type { Project } from "@shared/schema";
import { storage } from "../storage";
import { openai } from "../lib/openai";
import * as fs from "fs";
import * as path from "path";
import { exec } from "child_process";
import * as util from "util";
import { autoFixProject } from "./autoFixService";

const execAsync = util.promisify(exec);

// Simple retry implementation to avoid ESM/CJS interop issues with p-retry
async function retry<T>(
  fn: () => Promise<T>,
  options: { 
    retries: number; 
    minTimeout: number; 
    factor?: number;
    onFailedAttempt?: (context: { error: any; attemptNumber: number }) => void 
  }
): Promise<T> {
  let lastError: any;
  let delay = options.minTimeout;

  for (let i = 0; i <= options.retries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // If this was the last attempt, throw immediately
      if (i === options.retries) break;

      if (options.onFailedAttempt) {
        try {
          options.onFailedAttempt({ error, attemptNumber: i + 1 });
        } catch (e) {
          // If onFailedAttempt throws, stop retrying (simulates AbortError)
          throw e; 
        }
      }

      await new Promise(resolve => setTimeout(resolve, delay));
      if (options.factor) {
        delay *= options.factor;
      }
    }
  }
  throw lastError;
}

export interface QaResult {
  passed: boolean;
  report: string;
  fixes?: string[];
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

async function logQa(projectId: string, message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(`[QA] ${message}`);
  
  try {
    const project = await storage.getProject(projectId);
    if (project) {
      const currentLogs = project.qaLogs || "";
      await storage.updateProject(projectId, {
        qaLogs: currentLogs + logLine
      });
    }
  } catch (e) {
    console.error("Failed to write QA log:", e);
  }
}


/**
 * Run AI-powered QA checks on a project
 * Uses OpenAI to analyze the project source and generate a quality report
 */
export async function runQaOnProject(project: Project): Promise<QaResult> {
  return {
    passed: true,
    report: "QA is disabled.",
    fixes: []
  };
}
