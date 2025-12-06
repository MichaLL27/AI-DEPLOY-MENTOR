import type { Project } from "@shared/schema";

export function getAutoReadyMessage(project: Project): string | null {
  if (
    project.normalizedStatus === "success" &&
    project.autoFixStatus === "success" &&
    project.readyForDeploy === "true"
  ) {
    return "Fixed automatically – ready for Deployment";
  }
  return null;
}
