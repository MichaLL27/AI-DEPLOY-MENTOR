import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  label: string;
  description: string;
  status: "pending" | "current" | "completed" | "error";
}

interface DeploymentStepperProps {
  currentStep: number;
  steps: Step[];
  onStepClick?: (index: number) => void;
}

export function DeploymentStepper({ currentStep, steps, onStepClick }: DeploymentStepperProps) {
  return (
    <div className="w-full py-6">
      <div className="relative flex items-center justify-between w-full">
        <div className="absolute left-0 top-1/2 transform -translate-y-1/2 w-full h-1 bg-muted -z-10" />
        <div 
          className="absolute left-0 top-1/2 transform -translate-y-1/2 h-1 bg-primary -z-10 transition-all duration-500 ease-in-out"
          style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step, index) => {
          const isCompleted = index < currentStep || step.status === "completed";
          const isCurrent = index === currentStep;
          const isError = step.status === "error";

          return (
            <div 
              key={step.id} 
              className="flex flex-col items-center bg-background px-2 cursor-pointer"
              onClick={() => onStepClick && onStepClick(index)}
            >
              <div 
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                  isCompleted ? "bg-primary border-primary text-primary-foreground" : 
                  isCurrent ? "bg-background border-primary text-primary" : 
                  isError ? "bg-destructive border-destructive text-destructive-foreground" :
                  "bg-muted border-muted-foreground text-muted-foreground"
                )}
              >
                {isCompleted ? (
                  <Check className="w-6 h-6" />
                ) : isError ? (
                  <span className="text-lg font-bold">!</span>
                ) : isCurrent ? (
                  <span className="text-sm font-bold">{index + 1}</span>
                ) : (
                  <span className="text-sm font-bold">{index + 1}</span>
                )}
              </div>
              <div className="mt-2 text-center">
                <div className={cn(
                  "text-sm font-medium",
                  isCurrent ? "text-primary" : "text-muted-foreground"
                )}>
                  {step.label}
                </div>
                <div className="text-xs text-muted-foreground hidden sm:block max-w-[120px]">
                  {step.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
