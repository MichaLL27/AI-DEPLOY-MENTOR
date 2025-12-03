import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import type { Project } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { SourceIcon } from "@/components/source-icon";
import { StatusTimeline } from "@/components/status-timeline";
import { ProjectDetailSkeleton } from "@/components/project-skeleton";
import { AndroidBadge } from "@/components/android-badge";
import { IosBadge } from "@/components/ios-badge";
import { ProjectTypeBadge } from "@/components/project-type-badge";
import { ValidityBadge } from "@/components/validity-badge";
import { NormalizationBadge } from "@/components/normalization-badge";
import { AutoFixBadge } from "@/components/auto-fix-badge";
import { PullRequestList } from "@/components/pull-request-list";
import { MonitoringPanel } from "@/components/monitoring-panel";
import type { PullRequest } from "@shared/schema";
import {
  ArrowLeft,
  PlayCircle,
  Rocket,
  ExternalLink,
  Copy,
  Check,
  Clock,
  RefreshCw,
  Loader2,
  FileText,
  Link as LinkIcon,
  Smartphone,
  Download,
  Apple,
  ChevronDown,
  Wand2,
  Activity,
  Folder,
  File,
  Terminal,
  AlertCircle,
  CheckCircle,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { DeploymentStepper } from "@/components/deployment-stepper";
import { EnvVarsPanel } from "@/components/env-vars-panel";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [expandValidation, setExpandValidation] = useState(false);
  const [expandNormalization, setExpandNormalization] = useState(false);
  const [expandAutoFix, setExpandAutoFix] = useState(false);
  const [expandDeployLogs, setExpandDeployLogs] = useState(false);
  const [expandFiles, setExpandFiles] = useState(false);
  
  // Dialog states
  const [showAutoFixDialog, setShowAutoFixDialog] = useState(false);
  const [showQaDialog, setShowQaDialog] = useState(false);

  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: ["/api/projects", id],
    refetchInterval: (query) => {
      const data = query.state.data;
      // Poll if backend says running
      if (data?.status === "deploying" || data?.status === "qa_running" || data?.autoFixStatus === "running") {
        return 1000;
      }
      // Also poll if dialogs are open (to catch the start of the process and live logs)
      if (showAutoFixDialog || showQaDialog) {
        return 1000;
      }
      return false;
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: async (updates: Partial<Project>) => {
      const response = await apiRequest("PATCH", `/api/projects/${id}`, updates);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      toast({
        title: "Settings updated",
        description: "Project settings have been saved.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: files } = useQuery<{ files: { path: string; type: "file" | "directory" }[] }>({
    queryKey: [`/api/projects/${id}/files`],
    enabled: !!project?.normalizedFolderPath,
  });

  const { data: providerConfig } = useQuery<{ vercel: boolean; render: boolean; railway: boolean }>({
    queryKey: ["/api/config/providers"],
  });

  const runQaMutation = useMutation({
    mutationFn: async () => {
      setShowQaDialog(true);
      const response = await apiRequest("POST", `/api/projects/${id}/run-qa`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      // Dialog stays open to show results
      
      if (data.status === "qa_failed") {
        toast({
          title: "QA failed",
          description: "Quality checks failed. Please check the report.",
          variant: "destructive",
        });
      } else {
        // Check if fixes were applied
        const fixes = data.qaReport?.match(/\[QA Auto-Fix\] Applied (\d+) fixes/);
        const fixCount = fixes ? fixes[1] : 0;
        
        toast({
          title: fixCount > 0 ? `QA Passed with ${fixCount} Auto-Fixes` : "QA completed",
          description: fixCount > 0 
            ? "Issues were detected and automatically repaired by AI." 
            : "Quality checks have passed successfully.",
        });
      }
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      toast({
        title: "QA failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deployMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/projects/${id}/deploy`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Deployment successful",
        description: `Your project is now live at ${data.deployedUrl}`,
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      toast({
        title: "Deployment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateAndroidMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/mobile-android/${id}/generate`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Android project generated",
        description: "Your Android Studio project is ready for download.",
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      toast({
        title: "Android generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const generateIosMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/mobile-ios/${id}/generate`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "iOS project generated",
        description: "Your Xcode project is ready for download.",
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      toast({
        title: "iOS generation failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const autoFixMutation = useMutation({
    mutationFn: async () => {
      setShowAutoFixDialog(true);
      const response = await apiRequest("POST", `/api/projects/${id}/auto-fix`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/prs`] });
      
      // Dialog stays open to show results

      if (data.autoFixStatus === "failed") {
        toast({
          title: "Auto-fix failed",
          description: "The auto-fix process encountered errors. Check the report for details.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Auto-fix completed",
          description: data.readyForDeploy ? "Project is now ready for deployment!" : "Project was fixed. Check the report.",
        });
      }
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      toast({
        title: "Auto-fix failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const { data: prs = [] } = useQuery<PullRequest[]>({
    queryKey: [`/api/projects/${id}/prs`],
  });

  const mergePrMutation = useMutation({
    mutationFn: async (prId: string) => {
      const response = await apiRequest("POST", `/api/prs/${prId}/merge`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/prs`] });
      toast({ title: "PR merged successfully" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to merge PR",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const closePrMutation = useMutation({
    mutationFn: async (prId: string) => {
      const response = await apiRequest("POST", `/api/prs/${prId}/close`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/prs`] });
      toast({ title: "PR closed" });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to close PR",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/projects/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project deleted",
        description: "The project has been successfully deleted.",
      });
      setLocation("/");
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied to clipboard",
      description: "The URL has been copied to your clipboard.",
    });
  };

  if (isLoading) {
    return (
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <ProjectDetailSkeleton />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-destructive mb-2">Project Not Found</h2>
          <p className="text-muted-foreground mb-6">
            The project you're looking for doesn't exist or has been removed.
          </p>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const canRunQa = (project.status === "registered" || project.status === "qa_failed") && 
    project.autoFixStatus === "success";
  
  const canDeploy = project.status === "qa_passed" || project.status === "deployed" || project.status === "deploy_failed" || project.status === "qa_failed";
  const isDeployed = project.status === "deployed";
  const isRunningQa = project.status === "qa_running" || runQaMutation.isPending;
  const isDeploying = project.status === "deploying" || deployMutation.isPending;
  const canGenerateAndroid = isDeployed && project.deployedUrl;
  const isGeneratingAndroid = generateAndroidMutation.isPending || project.mobileAndroidStatus === "building";
  const canGenerateIos = isDeployed && project.deployedUrl;
  const isGeneratingIos = generateIosMutation.isPending || project.mobileIosStatus === "building";
  
  const canAutoFix = !!project.normalizedFolderPath && project.autoFixStatus !== "running";
  const isAutoFixing = autoFixMutation.isPending || project.autoFixStatus === "running";
  const autoReadyMessage = (project as any).autoReadyMessage;

  // Determine current step for stepper
  let currentStep = 0;
  if (project.autoFixStatus === "success") currentStep = 1;
  if (project.status === "qa_passed" || project.status === "qa_failed" || project.status === "deploy_failed") currentStep = 2;
  if (project.status === "deployed") currentStep = 3;

  // Override for specific states
  if (project.status === "qa_running") currentStep = 1; // QA is running, so we are past step 1
  if (project.status === "deploying") currentStep = 2; // Deploying, so we are past step 2

  const steps = [
    { 
      id: "fix", 
      label: "Analysis & Fix", 
      description: "Code repair & Env detection",
      status: project.autoFixStatus === "success" ? "completed" : project.autoFixStatus === "failed" ? "error" : "pending"
    },
    { 
      id: "qa", 
      label: "Quality Assurance", 
      description: "Run tests & checks",
      status: project.status === "qa_passed" ? "completed" : project.status === "qa_failed" ? "error" : "pending"
    },
    { 
      id: "deploy", 
      label: "Deployment", 
      description: "Push to production",
      status: project.status === "deployed" ? "completed" : project.status === "deploy_failed" ? "error" : "pending"
    },
    { 
      id: "live", 
      label: "Live", 
      description: "Monitor application",
      status: project.status === "deployed" ? "completed" : "pending"
    }
  ] as any[];

  return (
    <div className="container max-w-6xl mx-auto py-8 px-4 space-y-8">
      {/* Header Section */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-sm">
        <div className="absolute inset-0 bg-grid-slate-200/50 dark:bg-grid-slate-800/50 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] dark:[mask-image:linear-gradient(0deg,rgba(255,255,255,0.1),rgba(255,255,255,0.5))]" />
        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground -ml-2" data-testid="button-back">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Projects
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                {isDeployed && project.deployedUrl && (
                  <a href={project.deployedUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="outline" size="sm" className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
                      <ExternalLink className="h-3.5 w-3.5 mr-2" />
                      View Live App
                    </Button>
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex items-start gap-5">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shadow-inner border border-primary/10">
                  <span className="text-3xl font-bold text-primary">
                    {project.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="space-y-2">
                  <h1 
                    className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground"
                    data-testid="text-project-title"
                  >
                    {project.name}
                  </h1>
                  <div className="flex items-center gap-3 flex-wrap">
                    <SourceIcon sourceType={project.sourceType} />
                    <StatusBadge status={project.status} />
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      Updated {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {canAutoFix && (
                  <Button
                    onClick={() => autoFixMutation.mutate()}
                    disabled={isAutoFixing}
                    className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
                    data-testid="button-auto-fix"
                  >
                    {isAutoFixing ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    Auto-fix Project
                  </Button>
                )}

                {canRunQa && (
                  <Button
                    variant={canAutoFix ? "outline" : "default"}
                    onClick={() => runQaMutation.mutate()}
                    disabled={isRunningQa}
                    className="bg-white dark:bg-slate-800 shadow-sm"
                    data-testid="button-run-qa"
                  >
                    {isRunningQa ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <PlayCircle className="h-4 w-4 mr-2" />
                    )}
                    Run QA
                  </Button>
                )}

                {canDeploy && (
                  <Button
                    variant={project.status === "qa_failed" ? "destructive" : "default"}
                    onClick={() => deployMutation.mutate()}
                    disabled={isDeploying}
                    className="shadow-sm"
                    data-testid="button-deploy"
                  >
                    {isDeploying ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Rocket className="h-4 w-4 mr-2" />
                    )}
                    {project.status === "qa_failed" ? "Deploy Anyway" : (isDeployed ? "Redeploy" : "Deploy")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Status & Actions */}
      <div className="grid gap-6">
        <Card className="border-none shadow-md bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
          <CardContent className="p-6 sm:p-8">
            <div className="mb-8">
              <DeploymentStepper currentStep={currentStep} steps={steps} />
            </div>

            {/* Guided Action Center */}
            <div className="flex flex-col items-center justify-center text-center space-y-6 max-w-2xl mx-auto">
              <div className="space-y-2">
                <h3 className="text-2xl font-semibold tracking-tight">
                  {currentStep === 0 && "Phase 1: Analysis & Repair"}
                  {currentStep === 1 && "Phase 2: Quality Assurance"}
                  {currentStep === 2 && "Phase 3: Production Deployment"}
                  {currentStep === 3 && "Project is Live"}
                </h3>
                <p className="text-muted-foreground text-base">
                  {currentStep === 0 && "We'll scan your code, fix common errors, generate missing config files, and detect environment variables."}
                  {currentStep === 1 && "We'll run a comprehensive quality assurance check to ensure your app is stable and bug-free."}
                  {currentStep === 2 && "We'll sync your environment variables and push your application to the cloud."}
                  {currentStep === 3 && "Your application is running successfully. You can monitor its status below."}
                </p>
              </div>

              <div className="flex flex-wrap justify-center gap-4 w-full">
                {currentStep === 0 && (
                  <Button
                    onClick={() => autoFixMutation.mutate()}
                    disabled={isAutoFixing}
                    size="lg"
                    className="h-12 px-8 text-base bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/20 transition-all hover:scale-105"
                  >
                    {isAutoFixing ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="h-5 w-5 mr-2" />
                    )}
                    Fix Automatically
                  </Button>
                )}

                {currentStep === 1 && (
                  <Button
                    onClick={() => runQaMutation.mutate()}
                    disabled={isRunningQa}
                    size="lg"
                    className="h-12 px-8 text-base bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-105"
                  >
                    {isRunningQa ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <PlayCircle className="h-5 w-5 mr-2" />
                    )}
                    Run QA Checks
                  </Button>
                )}

                {currentStep === 2 && (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <div className="flex items-center gap-3 bg-muted/50 p-2 rounded-lg border">
                      <span className="text-sm font-medium text-muted-foreground pl-2">Deploy to:</span>
                      <Select
                        value={project.deploymentTarget || "auto"}
                        onValueChange={(val) => updateProjectMutation.mutate({ deploymentTarget: val as any })}
                        disabled={isDeploying}
                      >
                        <SelectTrigger className="w-[180px] h-9 bg-background border-0 shadow-sm">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">Auto (Best Available)</SelectItem>
                          <SelectItem value="vercel" disabled={!providerConfig?.vercel}>
                            Vercel {!providerConfig?.vercel && "(Not Configured)"}
                          </SelectItem>
                          <SelectItem value="render" disabled={!providerConfig?.render}>
                            Render {!providerConfig?.render && "(Not Configured)"}
                          </SelectItem>
                          <SelectItem value="railway" disabled={!providerConfig?.railway}>
                            Railway {!providerConfig?.railway && "(Not Configured)"}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={() => deployMutation.mutate()}
                      disabled={isDeploying}
                      size="lg"
                      className="h-12 px-8 text-base bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white shadow-lg shadow-green-500/20 transition-all hover:scale-105 w-full sm:w-auto min-w-[200px]"
                    >
                      {isDeploying ? (
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      ) : (
                        <Rocket className="h-5 w-5 mr-2" />
                      )}
                      Deploy Now
                    </Button>
                  </div>
                )}
                
                {currentStep === 3 && (
                   <Button
                    variant="outline"
                    size="lg"
                    onClick={() => deployMutation.mutate()}
                    disabled={isDeploying}
                    className="h-12 px-8 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Redeploy
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Notifications */}
        <div className="space-y-4">
          {project.lastDeployStatus === "recovery_triggered" && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900 p-4 flex items-start gap-4 shadow-sm">
              <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center shrink-0">
                <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100">Self-healing Triggered</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  The system detected a failure and automatically redeployed your application to restore service.
                </p>
              </div>
            </div>
          )}

          {project.status === "qa_failed" && (
            <div className="rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900 p-4 flex items-start gap-4 shadow-sm">
              <div className="h-10 w-10 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-red-900 dark:text-red-100">QA Checks Failed</h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1 mb-3">
                  The project has critical issues that might prevent successful deployment.
                </p>
                <div className="text-sm bg-white/60 dark:bg-black/20 p-3 rounded-lg border border-red-100 dark:border-red-900/50 font-medium text-red-800 dark:text-red-200">
                  {(() => {
                    const report = project.qaReport || "";
                    const keyErrorMatch = report.match(/\*\*Key Error:\*\*\s*(.+?)(\n|$)/);
                    if (keyErrorMatch) return keyErrorMatch[1];
                    const summaryMatch = report.match(/\*\*Verdict:\*\* FAIL[^\n]*\n\*\*Reason:\*\*\s*(.+?)(\n|$)/);
                    if (summaryMatch) return summaryMatch[1];
                    const summarySectionMatch = report.match(/## \d+\.\s*Summary & Verdict\s*\n(.+?)(\.|\n)/);
                    if (summarySectionMatch) return summarySectionMatch[1] + ".";
                    const criticalErrorMatch = report.match(/fails with a critical error[:\s]+(.+?)(\.|\n)/);
                    if (criticalErrorMatch) return "Critical Error: " + criticalErrorMatch[1];
                    return "Please review the full QA report below for details.";
                  })()}
                </div>
              </div>
            </div>
          )}

          {autoReadyMessage && (
            <div className="rounded-xl border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900 p-4 flex items-start gap-4 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Wand2 className="h-24 w-24 text-green-600" />
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center shrink-0 z-10">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 z-10">
                <h4 className="font-semibold text-green-900 dark:text-green-100">{autoReadyMessage}</h4>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1 mb-4">
                  This project was automatically normalized, repaired and validated. Please run QA to verify before deployment.
                </p>
                <div className="flex flex-wrap gap-3">
                  {project.status === "qa_passed" ? (
                    <Button
                      onClick={() => deployMutation.mutate()}
                      disabled={isDeploying}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
                      data-testid="button-deploy-now-ready"
                    >
                      {isDeploying ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Rocket className="h-4 w-4 mr-2" />
                      )}
                      Deploy Now
                    </Button>
                  ) : (
                    <Button
                      onClick={() => runQaMutation.mutate()}
                      disabled={isRunningQa}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
                      data-testid="button-qa-now-ready"
                    >
                      {isRunningQa ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <PlayCircle className="h-4 w-4 mr-2" />
                      )}
                      Run QA Check
                    </Button>
                  )}
                  {project.autoFixReport && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setExpandAutoFix(true)}
                      className="bg-white/50 dark:bg-black/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-900/30"
                      data-testid="button-view-autofix-ready"
                    >
                      View Auto-Fix Report
                    </Button>
                  )}
                  {prs && prs.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                      className="bg-white/50 dark:bg-black/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-900/30"
                      data-testid="button-view-pr-ready"
                    >
                      View Pull Request
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>


      <div className="mb-8">
        <Card className="border-none shadow-md bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950">
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4 border-b bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm rounded-t-xl">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Project Pipeline
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <ProjectTypeBadge type={project.projectType} />
              <ValidityBadge validity={project.projectValidity} />
              <NormalizationBadge status={project.normalizedStatus} readyForDeploy={project.readyForDeploy === "true"} />
              <AutoFixBadge status={project.autoFixStatus} />
              {isDeployed && (
                <>
                  <AndroidBadge status={project.mobileAndroidStatus} />
                  <IosBadge status={project.mobileIosStatus} />
                </>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            <div className="py-4 px-2">
              <StatusTimeline project={project} />
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  System Logs & Reports
                </h3>
                <span className="text-xs text-muted-foreground">Click to expand details</span>
              </div>

              <div className="grid gap-3">
                {project.validationErrors && (
                  <div className="group border rounded-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 transition-all duration-200 shadow-sm hover:shadow-md">
                    <button
                      onClick={() => setExpandValidation(!expandValidation)}
                      className="w-full flex items-center justify-between p-4 text-sm font-medium"
                      data-testid="button-toggle-validation"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                          <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500" />
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-foreground font-semibold">Validation Issues</span>
                          <span className="text-xs text-muted-foreground">Review detected validation warnings</span>
                        </div>
                      </div>
                      <ChevronDown 
                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expandValidation ? 'rotate-180' : ''}`}
                      />
                    </button>
                    
                    {expandValidation && (
                      <div className="p-4 pt-0 text-sm space-y-2 border-t bg-muted/20">
                        <div className="text-muted-foreground mt-4">
                          {(() => {
                            let errors: string[] = [];
                            try {
                              const raw = project.validationErrors;
                              if (Array.isArray(raw)) {
                                errors = raw;
                              } else if (typeof raw === "string") {
                                errors = JSON.parse(raw);
                              }
                            } catch (e) {
                              // ignore parsing errors
                            }
                            
                            return Array.isArray(errors) ? errors.map((error: string, i: number) => (
                              <div key={i} className="flex gap-2 items-start mb-2 last:mb-0">
                                <span className="text-yellow-500 mt-1">•</span>
                                <span>{error}</span>
                              </div>
                            )) : null;
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {project.normalizedReport && (
                  <div className="group border rounded-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 transition-all duration-200 shadow-sm hover:shadow-md">
                    <button
                      onClick={() => setExpandNormalization(!expandNormalization)}
                      className="w-full flex items-center justify-between p-4 text-sm font-medium"
                      data-testid="button-toggle-normalization"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <FileText className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-foreground font-semibold">Normalization Report</span>
                          <span className="text-xs text-muted-foreground">Structure analysis and cleanup details</span>
                        </div>
                      </div>
                      <ChevronDown 
                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expandNormalization ? 'rotate-180' : ''}`}
                      />
                    </button>
                    
                    {expandNormalization && (
                      <div className="p-4 border-t bg-slate-50 dark:bg-slate-950">
                        <div className="font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                          {project.normalizedReport}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {project.autoFixReport && (
                  <div className="group border rounded-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 transition-all duration-200 shadow-sm hover:shadow-md">
                    <button
                      onClick={() => setExpandAutoFix(!expandAutoFix)}
                      className="w-full flex items-center justify-between p-4 text-sm font-medium"
                      data-testid="button-toggle-auto-fix"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                          <Wand2 className="h-4 w-4 text-purple-600 dark:text-purple-500" />
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-foreground font-semibold">Auto-fix Report</span>
                          <span className="text-xs text-muted-foreground">AI-powered code repairs and adjustments</span>
                        </div>
                      </div>
                      <ChevronDown 
                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expandAutoFix ? 'rotate-180' : ''}`}
                      />
                    </button>
                    
                    {expandAutoFix && (
                      <div className="p-4 border-t bg-slate-50 dark:bg-slate-950">
                        <div className="font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                          {project.autoFixReport}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {project.deployLogs && (
                  <div className="group border rounded-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 transition-all duration-200 shadow-sm hover:shadow-md">
                    <button
                      onClick={() => setExpandDeployLogs(!expandDeployLogs)}
                      className="w-full flex items-center justify-between p-4 text-sm font-medium"
                      data-testid="button-toggle-deploy-logs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-500/10 flex items-center justify-center">
                          <Terminal className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-foreground font-semibold">Deployment Logs</span>
                          <span className="text-xs text-muted-foreground">Live build and deployment output</span>
                        </div>
                      </div>
                      <ChevronDown 
                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expandDeployLogs ? 'rotate-180' : ''}`}
                      />
                    </button>
                    
                    {expandDeployLogs && (
                      <div className="border-t border-slate-800">
                        <div className="bg-black text-green-400 p-4 font-mono text-xs whitespace-pre-wrap h-80 overflow-y-auto custom-scrollbar">
                          <div className="flex items-center gap-2 text-slate-500 mb-2 pb-2 border-b border-slate-900">
                            <div className="w-3 h-3 rounded-full bg-red-500/20"></div>
                            <div className="w-3 h-3 rounded-full bg-yellow-500/20"></div>
                            <div className="w-3 h-3 rounded-full bg-green-500/20"></div>
                            <span className="ml-2">terminal — node</span>
                          </div>
                          {project.deployLogs}
                          <span className="animate-pulse">_</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {files && files.files.length > 0 && (
                  <div className="group border rounded-xl overflow-hidden bg-white/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-900 transition-all duration-200 shadow-sm hover:shadow-md">
                    <button
                      onClick={() => setExpandFiles(!expandFiles)}
                      className="w-full flex items-center justify-between p-4 text-sm font-medium"
                      data-testid="button-toggle-files"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                          <Folder className="h-4 w-4 text-blue-600 dark:text-blue-500" />
                        </div>
                        <div className="flex flex-col items-start">
                          <span className="text-foreground font-semibold">Project Files</span>
                          <span className="text-xs text-muted-foreground">Browse source code structure</span>
                        </div>
                      </div>
                      <ChevronDown 
                        className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${expandFiles ? 'rotate-180' : ''}`}
                      />
                    </button>
                    
                    {expandFiles && (
                      <div className="p-0 border-t max-h-80 overflow-y-auto">
                        {files.files.map((file, i) => (
                          <div key={i} className="flex items-center gap-2 py-2 px-4 hover:bg-muted/50 border-b last:border-0 text-sm">
                            {file.type === "directory" ? (
                              <Folder className="h-4 w-4 text-blue-500 flex-shrink-0" />
                            ) : (
                              <File className="h-4 w-4 text-slate-500 flex-shrink-0" />
                            )}
                            <span className="font-mono text-xs text-muted-foreground">{file.path}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isDeployed && (
        <div className="mb-8">
          <MonitoringPanel project={project} />
        </div>
      )}

      <div className="mb-8">
        <EnvVarsPanel 
          projectId={id!} 
          onDeploy={canDeploy ? () => deployMutation.mutate() : undefined}
          isDeploying={isDeploying}
        />
      </div>

      {prs && prs.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Code Pull Requests</h2>
          <PullRequestList
            prs={prs}
            onMerge={(prId) => mergePrMutation.mutate(prId)}
            onClose={(prId) => closePrMutation.mutate(prId)}
            isMerging={mergePrMutation.isPending ? mergePrMutation.variables : undefined}
            isClosing={closePrMutation.isPending ? closePrMutation.variables : undefined}
          />
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base font-medium">Project Details</CardTitle>
              <CardDescription>Source information and timestamps</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Source URL</label>
              <div className="mt-1 flex items-center gap-2">
                <code 
                  className="flex-1 text-sm bg-muted px-3 py-2 rounded-md font-mono truncate"
                  data-testid="text-source-url"
                >
                  {project.sourceValue}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => copyToClipboard(project.sourceValue)}
                  data-testid="button-copy-source"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Created
                </label>
                <p className="mt-1 text-sm" data-testid="text-created-at">
                  {format(new Date(project.createdAt), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Updated
                </label>
                <p className="mt-1 text-sm" data-testid="text-updated-at">
                  {formatDistanceToNow(new Date(project.updatedAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <LinkIcon className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base font-medium">Deployment Info</CardTitle>
              <CardDescription>QA report and live URL</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {project.qaReport && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">QA Report</label>
                <div 
                  className="mt-1 bg-muted p-3 rounded-md text-sm font-mono whitespace-pre-wrap"
                  data-testid="text-qa-report"
                >
                  {project.qaReport}
                </div>
              </div>
            )}

            {project.deployedUrl && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">Live URL</label>
                <div className="mt-1 flex items-center gap-2">
                  <a
                    href={project.deployedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-primary hover:underline font-mono bg-muted px-3 py-2 rounded-md truncate"
                    data-testid="link-deployed-url"
                  >
                    {project.deployedUrl}
                  </a>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => copyToClipboard(project.deployedUrl!)}
                    data-testid="button-copy-url"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {!project.qaReport && !project.deployedUrl && (
              <div className="text-center py-6 text-muted-foreground">
                <p className="text-sm">
                  {project.status === "registered"
                    ? "Run QA checks to generate a report"
                    : project.status === "qa_passed"
                    ? "Deploy your project to get a live URL"
                    : "Waiting for deployment..."}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 border border-red-200 rounded-lg overflow-hidden dark:border-red-900/50">
        <div className="bg-red-50 px-6 py-4 border-b border-red-200 dark:bg-red-900/10 dark:border-red-900/50">
          <h3 className="text-lg font-medium text-red-900 dark:text-red-200">Danger Zone</h3>
        </div>
        <div className="p-6 bg-white dark:bg-slate-950 flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-slate-900 dark:text-slate-200">Delete this project</h4>
            <p className="text-sm text-slate-500 mt-1">
              Once you delete a project, there is no going back. Please be certain.
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => {
              if (confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
                deleteProjectMutation.mutate();
              }
            }}
            disabled={deleteProjectMutation.isPending}
            data-testid="button-delete-project"
          >
            {deleteProjectMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            Delete Project
          </Button>
        </div>
      </div>

      {/* Auto-Fix Dialog */}
      <Dialog open={showAutoFixDialog} onOpenChange={setShowAutoFixDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-purple-600" />
              Auto-Fix Project
            </DialogTitle>
            <DialogDescription>
              AI-powered analysis and repair of your project structure and code.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isAutoFixing ? (
              <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-center py-4">
                   <div className="relative">
                      <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full animate-pulse"></div>
                      <Loader2 className="h-12 w-12 text-purple-600 animate-spin relative z-10" />
                   </div>
                </div>
                <p className="text-center text-lg font-medium animate-pulse">Analyzing and fixing issues...</p>
                
                <div className="bg-black rounded-md p-4 h-64 overflow-y-auto font-mono text-xs text-green-400 border border-slate-800 shadow-inner custom-scrollbar">
                   <div className="flex items-center gap-2 text-slate-500 mb-2 pb-2 border-b border-slate-900">
                      <Terminal className="h-3 w-3" />
                      <span>Auto-Fix Logs</span>
                   </div>
                   <pre className="whitespace-pre-wrap">{project.autoFixLogs || "Initializing..."}</pre>
                   <span className="animate-pulse">_</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border ${project.autoFixStatus === 'success' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {project.autoFixStatus === 'success' ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-600" />
                    )}
                    <h3 className="font-semibold">
                      {project.autoFixStatus === 'success' ? 'Auto-fix Completed Successfully' : 'Auto-fix Failed'}
                    </h3>
                  </div>
                  <p className="text-sm opacity-90">
                    {project.readyForDeploy ? "Your project is now ready for deployment." : "Some issues were fixed, but manual intervention might be needed."}
                  </p>
                </div>

                <ScrollArea className="h-[300px] rounded-md border p-4">
                  <h4 className="text-sm font-medium mb-3">Actions Taken:</h4>
                  <div className="space-y-2">
                    {project.autoFixReport?.split('\n').map((line, i) => {
                      if (line.trim().startsWith('•')) {
                        return (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span>{line.replace('•', '').trim()}</span>
                          </div>
                        );
                      }
                      return null;
                    })}
                    {!project.autoFixReport && <p className="text-sm text-muted-foreground">No report available.</p>}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowAutoFixDialog(false)}
              disabled={isAutoFixing}
            >
              Close
            </Button>
            {!isAutoFixing && project.autoFixStatus === 'success' && (
              <Button 
                onClick={() => {
                  setShowAutoFixDialog(false);
                  runQaMutation.mutate();
                }}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Proceed to QA
                <PlayCircle className="ml-2 h-4 w-4" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QA Dialog */}
      <Dialog open={showQaDialog} onOpenChange={setShowQaDialog}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Quality Assurance Check
            </DialogTitle>
            <DialogDescription>
              Running comprehensive tests and AI analysis on your codebase.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isRunningQa ? (
              <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-center py-4">
                   <div className="relative">
                      <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full animate-pulse"></div>
                      <Loader2 className="h-12 w-12 text-blue-600 animate-spin relative z-10" />
                   </div>
                </div>
                <p className="text-center text-lg font-medium animate-pulse">Running QA Checks...</p>
                
                <div className="bg-black rounded-md p-4 h-64 overflow-y-auto font-mono text-xs text-blue-400 border border-slate-800 shadow-inner custom-scrollbar">
                   <div className="flex items-center gap-2 text-slate-500 mb-2 pb-2 border-b border-slate-900">
                      <Terminal className="h-3 w-3" />
                      <span>QA Execution Logs</span>
                   </div>
                   <pre className="whitespace-pre-wrap">{project.qaLogs || "Initializing..."}</pre>
                   <span className="animate-pulse">_</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border ${project.status === 'qa_passed' ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-900' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-900'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {project.status === 'qa_passed' ? (
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    ) : (
                      <AlertCircle className="h-6 w-6 text-red-600" />
                    )}
                    <div>
                      <h3 className="font-semibold text-lg">
                        {project.status === 'qa_passed' ? 'QA Passed' : 'QA Failed'}
                      </h3>
                      {project.qaReport?.includes("[QA Auto-Fix]") && (
                         <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-200">
                           Auto-Healed
                         </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm opacity-90">
                    {project.status === 'qa_passed' 
                      ? "Your project passed all quality checks and is ready for deployment." 
                      : "Critical issues were found. Please review the report below."}
                  </p>
                </div>

                <ScrollArea className="h-[350px] rounded-md border p-4 bg-slate-50 dark:bg-slate-950">
                  <div className="space-y-4">
                    {/* Try to parse and highlight sections */}
                    {project.qaReport?.split('\n').map((line, i) => {
                      // Highlight Headers
                      if (line.startsWith('#') || line.endsWith(':')) {
                        return <h4 key={i} className="font-bold mt-4 mb-2 text-primary">{line.replace(/#/g, '')}</h4>;
                      }
                      // Highlight Errors
                      if (line.toLowerCase().includes('error') || line.toLowerCase().includes('fail')) {
                         return <p key={i} className="text-red-600 dark:text-red-400 font-medium text-sm py-1">{line}</p>;
                      }
                      // Highlight Success/Pass
                      if (line.toLowerCase().includes('pass') || line.toLowerCase().includes('success')) {
                         return <p key={i} className="text-green-600 dark:text-green-400 font-medium text-sm py-1">{line}</p>;
                      }
                      // Highlight Auto-Fixes
                      if (line.includes('[QA Auto-Fix]')) {
                         return <div key={i} className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-200 dark:border-blue-800 my-2">
                           <p className="text-blue-700 dark:text-blue-300 font-semibold text-sm">{line}</p>
                         </div>;
                      }
                      // Default
                      return <p key={i} className="text-sm text-muted-foreground whitespace-pre-wrap">{line}</p>;
                    })}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowQaDialog(false)}
              disabled={isRunningQa}
            >
              Close
            </Button>
            {!isRunningQa && project.status === 'qa_failed' && (
              <Button 
                onClick={() => {
                  setShowQaDialog(false);
                  autoFixMutation.mutate();
                }}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Wand2 className="mr-2 h-4 w-4" />
                Attempt AI Fix
              </Button>
            )}
            {!isRunningQa && project.status === 'qa_passed' && (
              <Button 
                onClick={() => {
                  setShowQaDialog(false);
                  deployMutation.mutate();
                }}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                Proceed to Deploy
                <Rocket className="ml-2 h-4 w-4" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
