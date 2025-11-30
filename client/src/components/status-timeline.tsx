import type { ProjectStatus } from "@shared/schema";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusTimelineProps {
  currentStatus: ProjectStatus;
}

const steps = [
  { status: "registered", label: "Registered" },
  { status: "qa_passed", label: "QA Passed", failStatus: "qa_failed", runningStatus: "qa_running" },
  { status: "deployed", label: "Deployed", failStatus: "deploy_failed", runningStatus: "deploying" },
] as const;

function getStepState(
  stepIndex: number,
  currentStatus: ProjectStatus
): "completed" | "current" | "running" | "failed" | "pending" {
  const step = steps[stepIndex];

  if (step.status === "registered") {
    return currentStatus === "registered" ? "current" : "completed";
  }

  if (step.failStatus && currentStatus === step.failStatus) {
    return "failed";
  }

  if (step.runningStatus && currentStatus === step.runningStatus) {
    return "running";
  }

  const statusOrder = ["registered", "qa_running", "qa_passed", "qa_failed", "deploying", "deployed", "deploy_failed"];
  const currentIndex = statusOrder.indexOf(currentStatus);
  const stepMainIndex = statusOrder.indexOf(step.status);

  if (currentIndex >= stepMainIndex && !["qa_failed", "deploy_failed"].includes(currentStatus)) {
    return "completed";
  }

  if (stepIndex === 1 && ["qa_running", "qa_passed", "qa_failed"].includes(currentStatus)) {
    if (currentStatus === "qa_passed") return "completed";
    if (currentStatus === "qa_running") return "running";
    if (currentStatus === "qa_failed") return "failed";
  }

  if (stepIndex === 2 && ["deploying", "deployed", "deploy_failed"].includes(currentStatus)) {
    if (currentStatus === "deployed") return "completed";
    if (currentStatus === "deploying") return "running";
    if (currentStatus === "deploy_failed") return "failed";
  }

  return "pending";
}

export function StatusTimeline({ currentStatus }: StatusTimelineProps) {
  return (
    <div className="flex items-center gap-2" data-testid="status-timeline">
      {steps.map((step, index) => {
        const state = getStepState(index, currentStatus);
        const isLast = index === steps.length - 1;

        return (
          <div key={step.status} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all",
                  state === "completed" && "bg-chart-2 border-chart-2 text-white",
                  state === "current" && "border-primary bg-primary/10 text-primary",
                  state === "running" && "border-chart-4 bg-chart-4/10 text-chart-4",
                  state === "failed" && "border-destructive bg-destructive/10 text-destructive",
                  state === "pending" && "border-muted-foreground/30 text-muted-foreground/50"
                )}
              >
                {state === "completed" && <CheckCircle2 className="h-4 w-4" />}
                {state === "running" && <Loader2 className="h-4 w-4 animate-spin" />}
                {(state === "current" || state === "pending" || state === "failed") && (
                  <Circle className="h-4 w-4" />
                )}
              </div>
              <span
                className={cn(
                  "text-xs mt-1.5 font-medium whitespace-nowrap",
                  state === "completed" && "text-chart-2",
                  state === "current" && "text-primary",
                  state === "running" && "text-chart-4",
                  state === "failed" && "text-destructive",
                  state === "pending" && "text-muted-foreground/50"
                )}
              >
                {step.label}
              </span>
            </div>

            {!isLast && (
              <div
                className={cn(
                  "h-0.5 w-12 sm:w-16 -mt-5",
                  getStepState(index + 1, currentStatus) !== "pending"
                    ? "bg-chart-2"
                    : "bg-muted-foreground/20"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
