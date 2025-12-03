import * as fs from "fs";
import * as path from "path";
import { openai } from "../lib/openai";
import { analyzeProjectStructure } from "./structureService";

/**
 * Generate real functional tests based on project structure
 */
export async function generateFunctionalTests(
  folderPath: string,
  projectType: string
): Promise<{ success: boolean; message: string }> {
  
  // 1. Analyze Structure to find Routes
  const structure = await analyzeProjectStructure(folderPath, projectType);
  const routes = structure.apiRoutes || [];

  if (routes.length === 0) {
    return { success: false, message: "No API routes detected to test." };
  }

  // 2. Prepare Test Directory
  const testDir = path.join(folderPath, "tests");
  if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });

  // 3. Generate Test Code via AI
  // We'll generate a single comprehensive test file for simplicity in this MVP
  const testFilePath = path.join(testDir, "functional.test.js");
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert QA Automation Engineer. 
          Generate a functional test file using 'jest' and 'supertest' (for Node.js) or 'pytest' (for Python).
          
          Context:
          - Project Type: ${projectType}
          - Detected Routes: ${JSON.stringify(routes.slice(0, 10))}
          
          Requirements:
          - Write REAL tests that call these endpoints.
          - For GET requests, check for 200 OK.
          - For POST requests, send dummy valid JSON data.
          - Handle authentication mocks if needed (assume no auth for now or mock it).
          - Output ONLY the code. No markdown.`
        },
        {
          role: "user",
          content: "Generate the test file."
        }
      ]
    });

    const testCode = response.choices[0]?.message?.content?.replace(/^```[a-z]*\n/, "").replace(/\n```$/, "") || "";
    
    if (testCode) {
      fs.writeFileSync(testFilePath, testCode);
      
      // 4. Update package.json to include test dependencies if needed
      if (projectType === "node_backend" || projectType === "express") {
        const pkgPath = path.join(folderPath, "package.json");
        if (fs.existsSync(pkgPath)) {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
          pkg.devDependencies = pkg.devDependencies || {};
          
          // We won't install them here to save time, but we'll add them to package.json
          // The next 'npm install' will pick them up.
          // Or we can try to install them if we are in auto-fix mode.
          if (!pkg.devDependencies.jest) pkg.devDependencies.jest = "^29.0.0";
          if (!pkg.devDependencies.supertest) pkg.devDependencies.supertest = "^6.0.0";
          
          // Update test script
          pkg.scripts = pkg.scripts || {};
          pkg.scripts.test = "jest";
          
          fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
        }
      }
      
      return { success: true, message: `Generated functional tests for ${routes.length} routes.` };
    }
  } catch (e) {
    console.error("Failed to generate tests:", e);
    return { success: false, message: "AI generation failed." };
  }

  return { success: false, message: "Unknown error." };
}
