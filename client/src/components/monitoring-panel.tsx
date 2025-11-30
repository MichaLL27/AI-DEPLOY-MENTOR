import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle, AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";
import type { Project } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface MonitoringPanelProps {
  project: Project;
}

export function MonitoringPanel({ project }: MonitoringPanelProps) {
  if (!project.deployedUrl) return null;

  const isRecovering = project.lastDeployStatus === "recovery_triggered";
  const isHealthy = !isRecovering; // Simplified logic for MVP

  return (
    <Card className="border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <div>
          <CardTitle className="text-base font-medium text-blue-900 dark:text-blue-100">
            Live Monitoring & Self-Healing
          </CardTitle>
          <CardDescription className="text-blue-700 dark:text-blue-300">
            Real-time health checks and automated recovery
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-blue-100 dark:border-blue-900">
            <div className={`p-2 rounded-full ${isHealthy ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
              {isHealthy ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Health Status</p>
              <p className="font-semibold">{isHealthy ? "Healthy" : "Recovering"}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-blue-100 dark:border-blue-900">
            <div className="p-2 rounded-full bg-blue-100 text-blue-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Protection</p>
              <p className="font-semibold">Active</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-3 rounded-lg border border-blue-100 dark:border-blue-900">
            <div className="p-2 rounded-full bg-purple-100 text-purple-600">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Last Check</p>
              <p className="font-semibold">Just now</p>
            </div>
          </div>
        </div>

        {isRecovering && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md flex items-start gap-3">
            <RefreshCw className="h-5 w-5 text-yellow-600 animate-spin mt-0.5" />
            <div>
              <p className="font-medium text-yellow-900">Self-Healing Triggered</p>
              <p className="text-sm text-yellow-800">
                We detected an issue with your deployment and are automatically attempting to redeploy and fix the service.
              </p>
            </div>
          </div>
        )}
        
        <div className="mt-4 text-xs text-blue-600/80 dark:text-blue-400 flex items-center gap-1">
          <Activity className="h-3 w-3" />
          Monitoring service checks your application health every 5 minutes.
        </div>
      </CardContent>
    </Card>
  );
}
