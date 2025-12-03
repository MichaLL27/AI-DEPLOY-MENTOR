import * as fs from "fs";
import * as path from "path";
import { openai } from "../lib/openai";

export interface SecurityIssue {
  severity: "critical" | "high" | "medium" | "low";
  file: string;
  line: number;
  description: string;
  recommendation: string;
  codeSnippet?: string;
}

export interface SecurityReport {
  issues: SecurityIssue[];
  score: number; // 0-100
  summary: string;
}

/**
 * Analyze project for security vulnerabilities using Static Analysis + AI
 */
export async function analyzeProjectSecurity(folderPath: string): Promise<SecurityReport> {
  const issues: SecurityIssue[] = [];
  
  // 1. Static Pattern Matching (Fast & Deterministic)
  const files = findSourceFiles(folderPath);
  
  for (const file of files) {
    const content = fs.readFileSync(file, "utf-8");
    const relativePath = path.relative(folderPath, file);
    
    // Check for Hardcoded Secrets
    const secretPatterns = [
      { regex: /(api_key|apikey|secret|token|password|pwd)\s*[:=]\s*['"`][a-zA-Z0-9_\-]{20,}['"`]/i, desc: "Potential hardcoded secret detected" },
      { regex: /-----BEGIN RSA PRIVATE KEY-----/, desc: "Private key found in source code" },
      { regex: /postgres:\/\/.*:.*@/, desc: "Hardcoded database connection string" },
      { regex: /mongodb:\/\/.*:.*@/, desc: "Hardcoded database connection string" }
    ];

    // Check for Dangerous Functions
    const dangerousPatterns = [
      { regex: /eval\s*\(/, desc: "Use of eval() is dangerous and can lead to RCE" },
      { regex: /child_process\.exec\s*\(\s*[^"']/, desc: "Unsanitized command execution detected" },
      { regex: /innerHTML\s*=/, desc: "Potential XSS vulnerability (innerHTML)" },
      { regex: /dangerouslySetInnerHTML/, desc: "Potential XSS vulnerability (React)" }
    ];

    const lines = content.split('\n');
    lines.forEach((line, index) => {
      // Secrets
      for (const pattern of secretPatterns) {
        if (pattern.regex.test(line) && !line.includes("process.env")) {
          issues.push({
            severity: "critical",
            file: relativePath,
            line: index + 1,
            description: pattern.desc,
            recommendation: "Move secrets to environment variables (.env)",
            codeSnippet: line.trim().substring(0, 100) // Truncate for safety
          });
        }
      }

      // Dangerous Code
      for (const pattern of dangerousPatterns) {
        if (pattern.regex.test(line)) {
          issues.push({
            severity: "high",
            file: relativePath,
            line: index + 1,
            description: pattern.desc,
            recommendation: "Use safer alternatives or sanitize input strictly.",
            codeSnippet: line.trim()
          });
        }
      }
    });
  }

  // 2. AI Deep Analysis (Contextual)
  // We pick the main server file or a few key files to analyze deeper
  const keyFiles = files.filter(f => 
    f.endsWith("server.js") || 
    f.endsWith("app.js") || 
    f.endsWith("auth.ts") || 
    f.endsWith("auth.js") ||
    f.includes("controller")
  ).slice(0, 3); // Limit to 3 files to save tokens

  for (const file of keyFiles) {
    try {
      const content = fs.readFileSync(file, "utf-8");
      const relativePath = path.relative(folderPath, file);

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You are a security expert. Analyze the provided code for security vulnerabilities (SQL Injection, NoSQL Injection, XSS, CSRF, Broken Auth). Return a JSON array of issues found. Format: [{ severity: 'high', description: '...', recommendation: '...' }]. If none, return []."
          },
          {
            role: "user",
            content: content
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(response.choices[0]?.message?.content || "{\"issues\": []}");
      if (result.issues && Array.isArray(result.issues)) {
        result.issues.forEach((issue: any) => {
          issues.push({
            severity: issue.severity || "medium",
            file: relativePath,
            line: 0, // AI often can't pinpoint line numbers accurately without line-numbered input
            description: issue.description,
            recommendation: issue.recommendation,
            codeSnippet: "AI Detected"
          });
        });
      }
    } catch (e) {
      console.error("AI Security Analysis failed for file:", file, e);
    }
  }

  // Calculate Score
  let score = 100;
  issues.forEach(i => {
    if (i.severity === "critical") score -= 20;
    if (i.severity === "high") score -= 10;
    if (i.severity === "medium") score -= 5;
    if (i.severity === "low") score -= 1;
  });
  score = Math.max(0, score);

  return {
    issues,
    score,
    summary: `Found ${issues.length} security issues. Security Score: ${score}/100`
  };
}

function findSourceFiles(dir: string): string[] {
  let results: string[] = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        if (!["node_modules", ".git", "dist", "build", "test", "tests"].includes(file)) {
          results = results.concat(findSourceFiles(filePath));
        }
      } else {
        if (/\.(js|ts|jsx|tsx|py|go|java)$/.test(file)) {
          results.push(filePath);
        }
      }
    });
  } catch (e) {
    // Ignore
  }
  return results;
}
