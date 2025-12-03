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

  return configs;
}
