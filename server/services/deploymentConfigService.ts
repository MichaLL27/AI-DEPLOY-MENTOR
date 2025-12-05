import * as fs from "fs";
import * as path from "path";

/**
 * Generate deployment configuration files for major cloud providers
 */
export async function generateCloudConfigs(folderPath: string, projectType: string, projectName: string) {
  const configs: string[] = [];

  // 1. DigitalOcean App Platform (app.yaml)
  const doConfig = `
name: ${projectName}
region: fra
services:
- name: web
  github:
    branch: main
    deploy_on_push: true
  http_port: 3000
  instance_count: 1
  instance_size_slug: basic-xs
  run_command: npm start
  envs:
  - key: NODE_ENV
    value: production
`;
  fs.writeFileSync(path.join(folderPath, "app.yaml"), doConfig.trim());
  configs.push("DigitalOcean (app.yaml)");

  // 2. Google App Engine (app.yaml)
  // Note: GAE also uses app.yaml, so we might have a conflict if we put both in root.
  // Usually you'd name them differently or put them in folders.
  // Let's name it app.gae.yaml
  const gaeConfig = `
runtime: nodejs18
instance_class: F1
automatic_scaling:
  target_cpu_utilization: 0.65
  min_instances: 0
  max_instances: 1
env_variables:
  NODE_ENV: 'production'
`;
  fs.writeFileSync(path.join(folderPath, "app.gae.yaml"), gaeConfig.trim());
  configs.push("Google App Engine (app.gae.yaml)");

  // 3. AWS Elastic Beanstalk (Dockerrun.aws.json)
  // Assuming we are using the Docker platform on EB
  const awsConfig = {
    AWSEBDockerrunVersion: "1",
    Image: {
      Name: `${projectName}:latest`,
      Update: "true"
    },
    Ports: [
      {
        ContainerPort: "3000"
      }
    ]
  };
  fs.writeFileSync(path.join(folderPath, "Dockerrun.aws.json"), JSON.stringify(awsConfig, null, 2));
  configs.push("AWS Elastic Beanstalk (Dockerrun.aws.json)");

  // 4. Render (render.yaml) - Blueprint
  const renderConfig = `
services:
  - type: web
    name: ${projectName}
    env: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
`;
  fs.writeFileSync(path.join(folderPath, "render.yaml"), renderConfig.trim());
  configs.push("Render (render.yaml)");

  // 5. Vercel (vercel.json)
  let vercelConfig: any = {
    version: 2,
    name: projectName,
  };

  let shouldWriteVercel = false;

  if (projectType === "angular") {
    // Try to find output path from angular.json
    let outputPath = "dist";
    const angularJsonPath = path.join(folderPath, "angular.json");
    if (fs.existsSync(angularJsonPath)) {
      try {
        const angularJson = JSON.parse(fs.readFileSync(angularJsonPath, "utf-8"));
        const defaultProject = angularJson.defaultProject || Object.keys(angularJson.projects)[0];
        if (defaultProject && angularJson.projects[defaultProject]?.architect?.build?.options?.outputPath) {
          outputPath = angularJson.projects[defaultProject].architect.build.options.outputPath;
        }
      } catch (e) {}
    }

    vercelConfig = {
      ...vercelConfig,
      builds: [
        {
          src: "package.json",
          use: "@vercel/static-build",
          config: { distDir: outputPath }
        }
      ],
      routes: [
        {
          src: "/(.*)",
          dest: "/index.html"
        }
      ]
    };
    shouldWriteVercel = true;
  } else if (projectType === "react_spa" || projectType === "vite") {
    // Check for Vite
    const isVite = fs.existsSync(path.join(folderPath, "vite.config.ts")) || fs.existsSync(path.join(folderPath, "vite.config.js"));
    const distDir = isVite ? "dist" : "build";

    vercelConfig = {
      ...vercelConfig,
      builds: [
        {
          src: "package.json",
          use: "@vercel/static-build",
          config: { distDir }
        }
      ],
      routes: [
        {
          src: "/(.*)",
          dest: "/index.html"
        }
      ]
    };
    shouldWriteVercel = true;
  } else if (projectType === "static_web") {
    vercelConfig = {
      ...vercelConfig,
      routes: [
        {
          src: "/(.*)",
          dest: "/index.html"
        }
      ]
    };
    shouldWriteVercel = true;
  } else {
    // Default fallback for unknown types (e.g. Node.js backend or generic)
    // If it's a backend, Vercel might need @vercel/node
    // But if it's just a generic frontend, let's try to be safe.
    // For now, let's NOT write vercel.json for unknown types to avoid breaking them if they have their own config.
    // UNLESS we are sure.
    
    // Actually, if we don't write vercel.json, Vercel tries to auto-detect.
    // The issue is often that Vercel auto-detects "Create React App" or "Vite" but fails to set the rewrite rule for SPA.
    // So if we can detect it's an SPA but projectType is generic, we should add it.
    
    // Let's add a generic catch-all that assumes if there is an index.html, it might be an SPA.
    if (fs.existsSync(path.join(folderPath, "index.html"))) {
       vercelConfig = {
        ...vercelConfig,
        routes: [
          {
            src: "/(.*)",
            dest: "/index.html"
          }
        ]
      };
      shouldWriteVercel = true;
    }
  }

  if (shouldWriteVercel) {
    fs.writeFileSync(path.join(folderPath, "vercel.json"), JSON.stringify(vercelConfig, null, 2));
    configs.push("Vercel (vercel.json)");
  }

  return configs;
}
