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

  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: ["/api/projects", id],
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === "deploying" || data?.status === "qa_running" || data?.autoFixStatus === "running") {
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
      const response = await apiRequest("POST", `/api/projects/${id}/run-qa`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      if (data.status === "qa_failed") {
        toast({
          title: "QA failed",
          description: "Quality checks failed. Please check the report.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "QA completed",
          description: "Quality checks have passed successfully.",
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
      const response = await apiRequest("POST", `/api/projects/${id}/auto-fix`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/prs`] });
      toast({
        title: "Auto-fix completed",
        description: data.readyForDeploy ? "Project is now ready for deployment!" : "Project was fixed. Check the report.",
      });
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
    <div className="container max-w-6xl mx-auto py-8 px-4">
      <div className="mb-8">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {project.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 
                className="text-2xl sm:text-3xl font-bold tracking-tight"
                data-testid="text-project-title"
              >
                {project.name}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <SourceIcon sourceType={project.sourceType} />
                <StatusBadge status={project.status} />
              </div>
            </div>
          </div>
          
          {isDeployed && project.deployedUrl && (
            <a href={project.deployedUrl} target="_blank" rel="noopener noreferrer">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Live App
              </Button>
            </a>
          )}
        </div>
      </div>

      {/* Stepper Component */}
      <div className="mb-8 bg-card rounded-xl border shadow-sm p-4">
        <DeploymentStepper currentStep={currentStep} steps={steps} />
        
        {/* Guided Action Area */}
        <div className="mt-6 flex flex-col items-center justify-center border-t pt-6">
          <h3 className="text-lg font-medium mb-4">
            {currentStep === 0 && "Step 1: Analyze and Fix Issues"}
            {currentStep === 1 && "Step 2: Verify Quality"}
            {currentStep === 2 && "Step 3: Deploy to Production"}
            {currentStep === 3 && "Project is Live!"}
          </h3>
          
          <div className="flex gap-4">
            {currentStep === 0 && (
              <Button
                onClick={() => autoFixMutation.mutate()}
                disabled={isAutoFixing}
                size="lg"
                className="bg-purple-600 hover:bg-purple-700 text-white min-w-[200px]"
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
                className="min-w-[200px]"
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
              <div className="flex flex-col gap-4 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Deploy to:</span>
                  <Select
                    value={project.deploymentTarget || "auto"}
                    onValueChange={(val) => updateProjectMutation.mutate({ deploymentTarget: val as any })}
                    disabled={isDeploying}
                  >
                    <SelectTrigger className="w-[180px]">
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
                  className="bg-green-600 hover:bg-green-700 text-white min-w-[200px]"
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
                onClick={() => deployMutation.mutate()}
                disabled={isDeploying}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Redeploy
              </Button>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground mt-3 text-center max-w-md">
            {currentStep === 0 && "We'll scan your code, fix common errors, generate missing config files, and detect environment variables."}
            {currentStep === 1 && "We'll run a comprehensive quality assurance check to ensure your app is stable and bug-free."}
            {currentStep === 2 && "We'll sync your environment variables and push your application to the cloud."}
            {currentStep === 3 && "Your application is running. You can monitor its status below."}
          </p>
        </div>
      </div>

      {project.lastDeployStatus === "recovery_triggered" && (
        <Alert className="mb-8 border-blue-500 bg-blue-50 dark:bg-blue-950">
          <Activity className="h-4 w-4 text-blue-600" />
          <AlertDescription className="ml-3 text-blue-900 dark:text-blue-100">
            <strong>Self-healing triggered:</strong> The system detected a failure and automatically redeployed your application to restore service.
          </AlertDescription>
        </Alert>
      )}

      {project.status === "qa_failed" && (
        <Alert className="mb-8 border-red-500 bg-red-50 dark:bg-red-950">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="ml-3 text-red-900 dark:text-red-100">
            <strong>QA Checks Failed:</strong> The project has critical issues that might prevent successful deployment.
            <div className="mt-2 text-sm bg-white/50 dark:bg-black/20 p-2 rounded border border-red-200 dark:border-red-900">
              {(() => {
                // Try to extract key error from report
                const report = project.qaReport || "";
                
                // 1. Explicit Key Error (Future proofing)
                const keyErrorMatch = report.match(/\*\*Key Error:\*\*\s*(.+?)(\n|$)/);
                if (keyErrorMatch) return keyErrorMatch[1];

                // 2. Explicit Reason (Future proofing)
                const summaryMatch = report.match(/\*\*Verdict:\*\* FAIL[^\n]*\n\*\*Reason:\*\*\s*(.+?)(\n|$)/);
                if (summaryMatch) return summaryMatch[1];

                // 3. Extract from Summary & Verdict section
                // Look for the first sentence in the Summary section
                const summarySectionMatch = report.match(/## \d+\.\s*Summary & Verdict\s*\n(.+?)(\.|\n)/);
                if (summarySectionMatch) return summarySectionMatch[1] + ".";

                // 4. Fallback: Look for "critical error" mentions
                const criticalErrorMatch = report.match(/fails with a critical error[:\s]+(.+?)(\.|\n)/);
                if (criticalErrorMatch) return "Critical Error: " + criticalErrorMatch[1];

                return "Please review the full QA report below for details.";
              })()}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {autoReadyMessage && (
        <Alert className="mb-8 border-green-600 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="ml-3">
            <p className="font-semibold text-green-900 dark:text-green-100">{autoReadyMessage}</p>
            <p className="text-sm text-green-800 dark:text-green-200 mt-1">
              This project was automatically normalized, repaired and validated. Please run QA to verify before deployment.
            </p>
            <div className="flex gap-2 mt-3">
              {project.status === "qa_passed" ? (
                <Button
                  onClick={() => deployMutation.mutate()}
                  disabled={isDeploying}
                  className="bg-green-600 hover:bg-green-700 text-white"
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
                  className="bg-green-600 hover:bg-green-700 text-white"
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
                  onClick={() => setExpandAutoFix(true)}
                  data-testid="button-view-autofix-ready"
                >
                  View Auto-Fix Report
                </Button>
              )}
              {prs && prs.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                  data-testid="button-view-pr-ready"
                >
                  View Pull Request
                </Button>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
      <div className="mb-8">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {project.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 
                className="text-2xl sm:text-3xl font-bold tracking-tight"
                data-testid="text-project-title"
              >
                {project.name}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <SourceIcon sourceType={project.sourceType} />
                <StatusBadge status={project.status} />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canAutoFix && (
              <Button
                onClick={() => autoFixMutation.mutate()}
                disabled={isAutoFixing}
                className="bg-purple-600 hover:bg-purple-700 text-white"
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
                variant={project.status === "qa_failed" ? "destructive" : (isDeployed ? "outline" : "default")}
                onClick={() => deployMutation.mutate()}
                disabled={isDeploying}
                data-testid="button-deploy"
              >
                {isDeploying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4 mr-2" />
                )}
                {project.status === "qa_failed" ? "Deploy Anyway" : (isDeployed ? "Redeploy Project" : "Deploy Project")}
              </Button>
            )}

            {isDeployed && project.deployedUrl && (
              <a href={project.deployedUrl} target="_blank" rel="noopener noreferrer">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Live App
                </Button>
              </a>
            )}
          </div>
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
          <CardContent className="space-y-6 pt-6">
            <div className="py-2 overflow-x-auto">
              <StatusTimeline project={project} />
            </div>
            
            <div className="grid gap-4">
            {project.validationErrors && (
              <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                <button
                  onClick={() => setExpandValidation(!expandValidation)}
                  className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                  data-testid="button-toggle-validation"
                >
                  <span className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    Validation Issues
                  </span>
                  <ChevronDown 
                    className={`h-4 w-4 transition-transform ${expandValidation ? 'rotate-180' : ''}`}
                  />
                </button>
                
                {expandValidation && (
                  <div className="p-3 pt-0 text-sm space-y-2 border-t bg-muted/20">
                    <div className="text-muted-foreground mt-2">
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
                          <div key={i} className="flex gap-2 items-start">
                            <span className="text-red-500 mt-1">•</span>
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
              <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                <button
                  onClick={() => setExpandNormalization(!expandNormalization)}
                  className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                  data-testid="button-toggle-normalization"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" />
                    Normalization Report
                  </span>
                  <ChevronDown 
                    className={`h-4 w-4 transition-transform ${expandNormalization ? 'rotate-180' : ''}`}
                  />
                </button>
                
                {expandNormalization && (
                  <div className="p-3 border-t bg-slate-50 dark:bg-slate-950">
                    <div className="font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                      {project.normalizedReport}
                    </div>
                  </div>
                )}
              </div>
            )}

            {project.autoFixReport && (
              <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                <button
                  onClick={() => setExpandAutoFix(!expandAutoFix)}
                  className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                  data-testid="button-toggle-auto-fix"
                >
                  <span className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4 text-purple-500" />
                    Auto-fix Report
                  </span>
                  <ChevronDown 
                    className={`h-4 w-4 transition-transform ${expandAutoFix ? 'rotate-180' : ''}`}
                  />
                </button>
                
                {expandAutoFix && (
                  <div className="p-3 border-t bg-slate-50 dark:bg-slate-950">
                    <div className="font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                      {project.autoFixReport}
                    </div>
                  </div>
                )}
              </div>
            )}

            {project.deployLogs && (
              <div className="border rounded-lg overflow-hidden bg-slate-950 shadow-inner">
                <button
                  onClick={() => setExpandDeployLogs(!expandDeployLogs)}
                  className="w-full flex items-center justify-between p-3 text-sm font-medium text-slate-300 hover:bg-slate-900 transition-colors"
                  data-testid="button-toggle-deploy-logs"
                >
                  <span className="flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Deployment Logs
                  </span>
                  <ChevronDown 
                    className={`h-4 w-4 transition-transform ${expandDeployLogs ? 'rotate-180' : ''}`}
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
              <div className="border rounded-lg overflow-hidden bg-white dark:bg-slate-900">
                <button
                  onClick={() => setExpandFiles(!expandFiles)}
                  className="w-full flex items-center justify-between p-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                  data-testid="button-toggle-files"
                >
                  <span className="flex items-center gap-2">
                    <Folder className="h-4 w-4 text-blue-500" />
                    Project Files (Source Code)
                  </span>
                  <ChevronDown 
                    className={`h-4 w-4 transition-transform ${expandFiles ? 'rotate-180' : ''}`}
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
    </div>
  );
}
