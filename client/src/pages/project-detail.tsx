import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
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
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { useState } from "react";

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [expandValidation, setExpandValidation] = useState(false);
  const [expandNormalization, setExpandNormalization] = useState(false);
  const [expandAutoFix, setExpandAutoFix] = useState(false);

  const { data: project, isLoading, error } = useQuery<Project>({
    queryKey: ["/api/projects", id],
  });

  const runQaMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/projects/${id}/run-qa`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "QA completed",
        description: "Quality checks have passed successfully.",
      });
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

  const canRunQa = project.status === "registered" || project.status === "qa_failed";
  const canDeploy = project.status === "qa_passed";
  const isDeployed = project.status === "deployed";
  const isRunningQa = project.status === "qa_running" || runQaMutation.isPending;
  const isDeploying = project.status === "deploying" || deployMutation.isPending;
  const canGenerateAndroid = isDeployed && project.deployedUrl;
  const isGeneratingAndroid = generateAndroidMutation.isPending || project.mobileAndroidStatus === "building";
  const canGenerateIos = isDeployed && project.deployedUrl;
  const isGeneratingIos = generateIosMutation.isPending || project.mobileIosStatus === "building";
  const canAutoFix = !project.readyForDeploy && project.normalizedStatus === "success";
  const isAutoFixing = autoFixMutation.isPending || project.autoFixStatus === "running";

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
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
            {canRunQa && (
              <Button
                variant="outline"
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
                onClick={() => deployMutation.mutate()}
                disabled={isDeploying}
                data-testid="button-deploy"
              >
                {isDeploying ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4 mr-2" />
                )}
                Deploy Now
              </Button>
            )}
            {isDeployed && project.deployedUrl && (
              <Button asChild data-testid="button-view-live">
                <a href={project.deployedUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Live
                </a>
              </Button>
            )}

            {canGenerateAndroid && project.mobileAndroidStatus !== "ready" && (
              <Button
                onClick={() => generateAndroidMutation.mutate()}
                disabled={isGeneratingAndroid}
                variant="outline"
                data-testid="button-generate-android"
              >
                {isGeneratingAndroid ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Smartphone className="h-4 w-4 mr-2" />
                )}
                Generate Android App
              </Button>
            )}

            {project.mobileAndroidStatus === "ready" && project.mobileAndroidDownloadUrl && (
              <Button asChild data-testid="button-download-android">
                <a href={project.mobileAndroidDownloadUrl} download>
                  <Download className="h-4 w-4 mr-2" />
                  Download Android Project
                </a>
              </Button>
            )}

            {canGenerateIos && project.mobileIosStatus !== "ready" && (
              <Button
                onClick={() => generateIosMutation.mutate()}
                disabled={isGeneratingIos}
                variant="outline"
                data-testid="button-generate-ios"
              >
                {isGeneratingIos ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Apple className="h-4 w-4 mr-2" />
                )}
                Generate iOS App
              </Button>
            )}

            {project.mobileIosStatus === "ready" && project.mobileIosDownloadUrl && (
              <Button asChild data-testid="button-download-ios">
                <a href={project.mobileIosDownloadUrl} download>
                  <Download className="h-4 w-4 mr-2" />
                  Download iOS Project
                </a>
              </Button>
            )}

            {canAutoFix && (
              <Button
                onClick={() => autoFixMutation.mutate()}
                disabled={isAutoFixing}
                variant="outline"
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
          </div>
        </div>
      </div>

      <div className="mb-8">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-4">
            <CardTitle className="text-base font-medium">Project Status</CardTitle>
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
          <CardContent className="space-y-4">
            <StatusTimeline currentStatus={project.status} />
            
            {project.validationErrors && (
              <div className="border-t pt-4">
                <button
                  onClick={() => setExpandValidation(!expandValidation)}
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-toggle-validation"
                >
                  <ChevronDown 
                    className={`h-4 w-4 transition-transform ${expandValidation ? 'rotate-180' : ''}`}
                  />
                  Project Structure
                </button>
                
                {expandValidation && (
                  <div className="mt-3 text-sm space-y-2">
                    {typeof project.validationErrors === "string" ? (
                      <div className="text-muted-foreground">
                        {JSON.parse(project.validationErrors).map((error: string, i: number) => (
                          <div key={i} className="flex gap-2">
                            <span>•</span>
                            <span>{error}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted-foreground">
                        {Array.isArray(project.validationErrors) && project.validationErrors.map((error: string, i: number) => (
                          <div key={i} className="flex gap-2">
                            <span>•</span>
                            <span>{error}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {project.normalizedReport && (
              <div className="border-t pt-4">
                <button
                  onClick={() => setExpandNormalization(!expandNormalization)}
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-toggle-normalization"
                >
                  <ChevronDown 
                    className={`h-4 w-4 transition-transform ${expandNormalization ? 'rotate-180' : ''}`}
                  />
                  Normalization Report
                </button>
                
                {expandNormalization && (
                  <div className="mt-3 text-sm">
                    <div className="bg-muted p-3 rounded font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                      {project.normalizedReport}
                    </div>
                  </div>
                )}
              </div>
            )}

            {project.autoFixReport && (
              <div className="border-t pt-4">
                <button
                  onClick={() => setExpandAutoFix(!expandAutoFix)}
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-toggle-auto-fix"
                >
                  <ChevronDown 
                    className={`h-4 w-4 transition-transform ${expandAutoFix ? 'rotate-180' : ''}`}
                  />
                  Auto-fix Report
                </button>
                
                {expandAutoFix && (
                  <div className="mt-3 text-sm">
                    <div className="bg-muted p-3 rounded font-mono text-xs whitespace-pre-wrap text-muted-foreground">
                      {project.autoFixReport}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

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
    </div>
  );
}
