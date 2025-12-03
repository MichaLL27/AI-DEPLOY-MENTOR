import type { Project } from "@shared/schema";
import { CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusTimelineProps {
  project: Project;
}

const steps = [
  { id: "build", label: "Build Started" },
  { id: "analysis", label: "AI Analysis" },
  { id: "fixing", label: "Auto-Fixing" },
  { id: "qa", label: "QA Check" },
  { id: "deploy", label: "Deployment" },
  { id: "monitor", label: "Monitoring" },
] as const;

function getStepState(
  stepId: string,
  project: Project
): "completed" | "current" | "running" | "failed" | "pending" {
  const { status, normalizedStatus, autoFixStatus, readyForDeploy } = project;

  switch (stepId) {
    case "build":
      // Only completed if we have moved past registration/initial analysis
      if (normalizedStatus === "success" || normalizedStatus === "failed") return "completed";
      return "current";

    case "analysis":
      if (normalizedStatus === "success") return "completed";
      if (normalizedStatus === "failed") return "failed";
      // If we are in any later stage, it's completed
      if (status !== "registered" || autoFixStatus !== "none") return "completed";
      // If build is done (which is practically always true once we have a project), analysis is next
      return "current";

    case "fixing":
      // If we are in QA or later stages, consider fixing "completed" (or skipped successfully)
      if (status === "qa_passed" || status === "qa_running" || status === "qa_failed" || status === "deploying" || status === "deployed") return "completed";
      
      if (autoFixStatus === "success") return "completed";
      if (autoFixStatus === "running") return "running";
      if (autoFixStatus === "failed") return "failed";
      
      // If analysis is done, we are ready for fixing
      if (normalizedStatus === "success") {
        // Even if ready for deploy, we show as current so user can choose to run it
        return "current";
      }
      return "pending";

    case "qa":
      // Check if QA actually failed based on report content, even if we moved past it
      const qaFailed = project.qaReport?.includes("Status: FAILED") || project.qaReport?.includes("Result: FAIL");
      
      if (status === "qa_passed") return "completed";
      if (status === "deploying" || status === "deployed" || status === "deploy_failed") {
        // If we deployed anyway despite failure, show as failed but completed (maybe orange?)
        // Or just keep it failed red to indicate the risk taken
        if (qaFailed) return "failed";
        return "completed";
      }
      if (status === "qa_running") return "running";
      if (status === "qa_failed") return "failed";
      // QA is next after fixing is done or skipped
      if (autoFixStatus === "success") return "current";
      return "pending";

    case "deploy":
      if (status === "deployed") return "completed";
      if (status === "deploying") return "running";
      if (status === "deploy_failed") return "failed";
      if (status === "qa_passed") return "current";
      return "pending";

    case "monitor":
      if (status === "deployed") return "current"; // Active monitoring
      return "pending";
      
    default:
      return "pending";
  }
}

export function StatusTimeline({ project }: StatusTimelineProps) {
  return (
    <div className="w-full overflow-x-auto pb-6 pt-2 scrollbar-hide">
      <div className="flex items-center justify-between min-w-[700px] px-4" data-testid="status-timeline">
        {steps.map((step, index) => {
          const state = getStepState(step.id, project);
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex-1 flex items-center relative group">
              <div className="flex flex-col items-center relative z-10 w-full">
                <div
                  className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-full border-2 transition-all duration-500 z-20 bg-background",
                    state === "completed" && "bg-primary border-primary text-primary-foreground shadow-[0_0_15px_rgba(var(--primary),0.3)]",
                    state === "current" && "border-primary text-primary ring-4 ring-primary/10 scale-110",
                    state === "running" && "border-blue-500 text-blue-500 animate-pulse ring-4 ring-blue-500/10",
                    state === "failed" && "border-destructive text-destructive bg-destructive/10",
                    state === "pending" && "border-muted-foreground/20 text-muted-foreground/20 bg-muted/10"
                  )}
                >
                  {state === "completed" && <CheckCircle2 className="h-5 w-5" />}
                  {state === "running" && <Loader2 className="h-5 w-5 animate-spin" />}
                  {state === "failed" && <AlertCircle className="h-5 w-5" />}
                  {(state === "current" || state === "pending") && (
                    <div className={cn("h-2.5 w-2.5 rounded-full", state === "current" ? "bg-primary" : "bg-muted-foreground/20")} />
                  )}
                </div>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-wider mt-3 font-bold whitespace-nowrap absolute top-9 transition-colors duration-300",
                    state === "completed" && "text-primary",
                    state === "current" && "text-primary",
                    state === "running" && "text-blue-600",
                    state === "failed" && "text-destructive",
                    state === "pending" && "text-muted-foreground/40"
                  )}
                >
                  {step.label}
                </span>
              </div>

              {!isLast && (
                <div className="absolute left-[50%] w-full h-[2px] top-[18px] -translate-y-1/2 z-0">
                  <div className="w-full h-full bg-muted/30" />
                  <div 
                    className={cn(
                      "absolute inset-0 h-full bg-primary transition-all duration-1000 ease-in-out origin-left",
                      state === "completed" ? "scale-x-100" : "scale-x-0"
                    )} 
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
