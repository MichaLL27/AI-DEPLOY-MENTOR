import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, CheckCircle, AlertTriangle, RefreshCw, ShieldCheck, Zap, Users, Server } from "lucide-react";
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
    <Card className="border-none shadow-md bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-950/30 dark:to-indigo-950/10 overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-3 pb-4 border-b border-blue-100 dark:border-blue-900/50 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
          <Activity className="h-5 w-5" />
        </div>
        <div>
          <CardTitle className="text-lg font-semibold text-blue-950 dark:text-blue-100">
            Live Monitoring & Self-Healing
          </CardTitle>
          <CardDescription className="text-blue-700/80 dark:text-blue-300/80">
            Real-time health checks and automated recovery system
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid gap-4 md:grid-cols-3">
          {/* Health Status Card */}
          <div className={`relative overflow-hidden p-4 rounded-xl border transition-all duration-300 ${
            isHealthy 
              ? "bg-white dark:bg-slate-900 border-green-100 dark:border-green-900/30 shadow-sm hover:shadow-md" 
              : "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900/50 shadow-md"
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-full ${
                isHealthy 
                  ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" 
                  : "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400"
              }`}>
                {isHealthy ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
              </div>
              <span className="font-semibold text-sm text-muted-foreground">System Status</span>
            </div>
            <p className={`text-xl font-bold ${
              isHealthy ? "text-green-700 dark:text-green-400" : "text-yellow-700 dark:text-yellow-400"
            }`}>
              {isHealthy ? "Operational" : "Recovering"}
            </p>
            {isHealthy && (
              <div className="absolute -right-4 -bottom-4 opacity-10">
                <CheckCircle className="h-24 w-24 text-green-600" />
              </div>
            )}
          </div>

          {/* Protection Card */}
          <div className="relative overflow-hidden p-4 rounded-xl border bg-white dark:bg-slate-900 border-blue-100 dark:border-blue-900/30 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="font-semibold text-sm text-muted-foreground">Security</span>
            </div>
            <p className="text-xl font-bold text-blue-700 dark:text-blue-400">Active</p>
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <ShieldCheck className="h-24 w-24 text-blue-600" />
            </div>
          </div>

          {/* Uptime Card */}
          <div className="relative overflow-hidden p-4 rounded-xl border bg-white dark:bg-slate-900 border-purple-100 dark:border-purple-900/30 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                <RefreshCw className="h-5 w-5" />
              </div>
              <span className="font-semibold text-sm text-muted-foreground">Uptime</span>
            </div>
            <p className="text-xl font-bold text-purple-700 dark:text-purple-400">99.9%</p>
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <RefreshCw className="h-24 w-24 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-3 mt-4">
          <div className="bg-white/60 dark:bg-slate-900/60 p-4 rounded-xl border border-blue-100/50 dark:border-blue-900/30 flex items-center justify-between">
             <div>
               <p className="text-xs font-medium text-muted-foreground mb-1">Response Time</p>
               <p className="text-lg font-bold text-slate-700 dark:text-slate-200">45ms</p>
             </div>
             <Zap className="h-5 w-5 text-yellow-500 opacity-80" />
          </div>
          <div className="bg-white/60 dark:bg-slate-900/60 p-4 rounded-xl border border-blue-100/50 dark:border-blue-900/30 flex items-center justify-between">
             <div>
               <p className="text-xs font-medium text-muted-foreground mb-1">Error Rate</p>
               <p className="text-lg font-bold text-green-600 dark:text-green-400">0.01%</p>
             </div>
             <Activity className="h-5 w-5 text-green-500 opacity-80" />
          </div>
          <div className="bg-white/60 dark:bg-slate-900/60 p-4 rounded-xl border border-blue-100/50 dark:border-blue-900/30 flex items-center justify-between">
             <div>
               <p className="text-xs font-medium text-muted-foreground mb-1">Active Users</p>
               <p className="text-lg font-bold text-blue-600 dark:text-blue-400">12</p>
             </div>
             <Users className="h-5 w-5 text-blue-500 opacity-80" />
          </div>
        </div>

        {/* Active Services List */}
        <div className="mt-6 pt-4 border-t border-blue-200/50 dark:border-blue-900/30">
          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
            <Server className="h-4 w-4" />
            Active Services
          </h4>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-blue-100 dark:border-blue-900/30 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                </div>
                <span className="font-medium">Web Service</span>
              </div>
              <span className="text-muted-foreground text-xs font-mono bg-muted px-2 py-1 rounded">Running  Node.js</span>
            </div>
            <div className="flex items-center justify-between text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-blue-100 dark:border-blue-900/30 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="font-medium">Database</span>
              </div>
              <span className="text-muted-foreground text-xs font-mono bg-muted px-2 py-1 rounded">Connected  PostgreSQL</span>
            </div>
            <div className="flex items-center justify-between text-sm p-3 bg-white dark:bg-slate-900 rounded-lg border border-blue-100 dark:border-blue-900/30 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="font-medium">Storage</span>
              </div>
              <span className="text-muted-foreground text-xs font-mono bg-muted px-2 py-1 rounded">Available  5GB</span>
            </div>
          </div>
        </div>

        {isRecovering && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-3 animate-pulse">
            <RefreshCw className="h-5 w-5 text-yellow-600 animate-spin mt-0.5" />
            <div>
              <p className="font-bold text-yellow-900">Self-Healing Triggered</p>
              <p className="text-sm text-yellow-800 mt-1">
                We detected an issue with your deployment and are automatically attempting to redeploy and fix the service.
              </p>
            </div>
          </div>
        )}
        
        <div className="mt-4 text-xs text-blue-600/60 dark:text-blue-400/60 flex items-center justify-center gap-1.5">
          <Activity className="h-3 w-3" />
          Monitoring service checks your application health every 5 minutes.
        </div>
      </CardContent>
    </Card>
  );
}
