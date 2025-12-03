import * as fs from "fs";
import * as path from "path";

export interface ApiRoute {
  path: string;
  method: string;
  file: string;
  line: number;
}

export interface DatabaseConfig {
  type: "postgres" | "mysql" | "mongodb" | "sqlite" | "unknown";
  orm: "prisma" | "drizzle" | "mongoose" | "sequelize" | "typeorm" | "sqlalchemy" | "none";
  connectionStringEnvVar?: string;
  configFile?: string;
}

export interface ProjectStructure {
  apiRoutes: ApiRoute[];
  databaseConfig: DatabaseConfig | null;
}

/**
 * Analyze project structure to detect API routes and Database configuration
 */
export async function analyzeProjectStructure(
  projectPath: string,
  projectType: string
): Promise<ProjectStructure> {
  const apiRoutes = await detectApiRoutes(projectPath, projectType);
  const databaseConfig = await detectDatabaseConfig(projectPath);

  return {
    apiRoutes,
    databaseConfig,
  };
}

/**
 * Detect API Routes based on project type
 */
async function detectApiRoutes(dir: string, projectType: string): Promise<ApiRoute[]> {
  const routes: ApiRoute[] = [];
  const files = listFilesRecursive(dir);

  for (const file of files) {
    if (file.includes("node_modules") || file.includes(".git") || file.includes("dist") || file.includes("build")) continue;
    
    const content = fs.readFileSync(file, "utf-8");
    const relativePath = path.relative(dir, file).replace(/\\/g, "/");

    // Node/Express
    if (projectType === "node_backend" || file.endsWith(".js") || file.endsWith(".ts")) {
      // app.get('/path', ...), router.post('/path', ...)
      const expressRegex = /\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
      let match;
      while ((match = expressRegex.exec(content)) !== null) {
        routes.push({
          method: match[1].toUpperCase(),
          path: match[2],
          file: relativePath,
          line: getLineNumber(content, match.index),
        });
      }
    }

    // Next.js Pages Router
    if (projectType === "nextjs" && (relativePath.startsWith("pages/api/") || relativePath.startsWith("src/pages/api/"))) {
      // File-based routing
      const routePath = "/api/" + relativePath
        .replace(/^(src\/)?pages\/api\//, "")
        .replace(/\.(js|ts)$/, "")
        .replace(/index$/, "");
      
      routes.push({
        method: "ALL", // Next.js API routes handle methods inside
        path: routePath,
        file: relativePath,
        line: 1,
      });
    }

    // Next.js App Router
    if (projectType === "nextjs" && (relativePath.includes("app/api/") || relativePath.includes("src/app/api/"))) {
       if (relativePath.endsWith("route.ts") || relativePath.endsWith("route.js")) {
          const routePath = "/api/" + relativePath
            .split("api/")[1]
            .replace(/\/route\.(js|ts)$/, "");
          
          // Check for exported methods
          const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
          for (const method of methods) {
            if (content.includes(`export async function ${method}`) || content.includes(`export function ${method}`)) {
               routes.push({
                method: method,
                path: routePath,
                file: relativePath,
                line: getLineNumber(content, content.indexOf(`function ${method}`)),
              });
            }
          }
       }
    }

    // Python Flask
    if (projectType === "python_flask" && file.endsWith(".py")) {
      // @app.route('/path', methods=['GET'])
      const flaskRegex = /@\w+\.route\s*\(\s*['"`]([^'"`]+)['"`]/g;
      let match;
      while ((match = flaskRegex.exec(content)) !== null) {
        // Try to find methods
        const methodMatch = content.substring(match.index, match.index + 100).match(/methods\s*=\s*\[(.*?)\]/);
        let methods = "GET";
        if (methodMatch) {
          methods = methodMatch[1].replace(/['"\s]/g, "");
        }

        routes.push({
          method: methods,
          path: match[1],
          file: relativePath,
          line: getLineNumber(content, match.index),
        });
      }
    }
  }

  return routes;
}

/**
 * Detect Database Configuration
 */
async function detectDatabaseConfig(dir: string): Promise<DatabaseConfig | null> {
  const files = listFilesRecursive(dir);
  const relativePaths = files.map(f => path.relative(dir, f).replace(/\\/g, "/"));

  // 1. Prisma
  if (relativePaths.some(p => p.includes("schema.prisma"))) {
    const schemaPath = files.find(f => f.endsWith("schema.prisma"));
    let dbType: DatabaseConfig["type"] = "unknown";
    let envVar = "DATABASE_URL";

    if (schemaPath) {
      const content = fs.readFileSync(schemaPath, "utf-8");
      if (content.includes('provider = "postgresql"')) dbType = "postgres";
      else if (content.includes('provider = "mysql"')) dbType = "mysql";
      else if (content.includes('provider = "mongodb"')) dbType = "mongodb";
      else if (content.includes('provider = "sqlite"')) dbType = "sqlite";

      const envMatch = content.match(/url\s*=\s*env\("([^"]+)"\)/);
      if (envMatch) envVar = envMatch[1];
    }

    return {
      type: dbType,
      orm: "prisma",
      configFile: "prisma/schema.prisma",
      connectionStringEnvVar: envVar,
    };
  }

  // 2. Drizzle
  if (relativePaths.some(p => p.includes("drizzle.config"))) {
    return {
      type: "postgres", // Default assumption, hard to parse config file statically without executing
      orm: "drizzle",
      configFile: relativePaths.find(p => p.includes("drizzle.config")),
      connectionStringEnvVar: "DATABASE_URL",
    };
  }

  // 3. Mongoose
  for (const file of files) {
    if (file.endsWith(".js") || file.endsWith(".ts")) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("mongoose.connect")) {
        return {
          type: "mongodb",
          orm: "mongoose",
          configFile: path.relative(dir, file),
          connectionStringEnvVar: "MONGODB_URI", // Common convention
        };
      }
    }
  }

  // 4. TypeORM
  if (relativePaths.some(p => p.includes("ormconfig"))) {
    return {
      type: "unknown",
      orm: "typeorm",
      configFile: relativePaths.find(p => p.includes("ormconfig")),
    };
  }

  // 5. Python SQLAlchemy
  for (const file of files) {
    if (file.endsWith(".py")) {
      const content = fs.readFileSync(file, "utf-8");
      if (content.includes("SQLAlchemy") || content.includes("flask_sqlalchemy")) {
        return {
          type: "unknown", // Could be anything
          orm: "sqlalchemy",
          configFile: path.relative(dir, file),
          connectionStringEnvVar: "SQLALCHEMY_DATABASE_URI",
        };
      }
    }
  }

  return null;
}

function listFilesRecursive(dir: string): string[] {
  let results: string[] = [];
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        if (file !== "node_modules" && file !== ".git") {
          results = results.concat(listFilesRecursive(filePath));
        }
      } else {
        results.push(filePath);
      }
    });
  } catch (e) {
    // Ignore access errors
  }
  return results;
}

function getLineNumber(content: string, index: number): number {
  return content.substring(0, index).split("\n").length;
}
