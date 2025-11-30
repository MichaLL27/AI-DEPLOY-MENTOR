import { useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import type { Project } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "./status-badge";
import { SourceIcon } from "./source-icon";
import { 
  PlayCircle, 
  Rocket, 
  ExternalLink, 
  ChevronRight,
  Loader2,
  Clock,
  CheckCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ProjectCardProps {
  project: Project;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const { toast } = useToast();

  const runQaMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/projects/${project.id}/run-qa`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      toast({
        title: "QA completed",
        description: "Quality checks have passed successfully.",
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "QA failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deployMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/projects/${project.id}/deploy`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      toast({
        title: "Deployment successful",
        description: `Your project is now live at ${data.deployedUrl}`,
      });
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Deployment failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const canRunQa = project.status === "registered" || project.status === "qa_failed";
  const canDeploy = project.status === "qa_passed";
  const isDeployed = project.status === "deployed";
  const isRunningQa = project.status === "qa_running" || runQaMutation.isPending;
  const isDeploying = project.status === "deploying" || deployMutation.isPending;

  return (
    <Card 
      className="overflow-visible hover-elevate transition-all duration-200"
      data-testid={`card-project-${project.id}`}
    >
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-4 min-w-0 flex-1">
            <div className="shrink-0 h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center">
              <span className="text-lg font-bold text-primary">
                {project.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <Link href={`/projects/${project.id}`}>
                <h3 
                  className="font-semibold truncate hover:text-primary transition-colors cursor-pointer"
                  data-testid={`text-project-name-${project.id}`}
                >
                  {project.name}
                </h3>
              </Link>
              <div className="flex items-center gap-3 mt-1">
                <SourceIcon sourceType={project.sourceType} />
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <StatusBadge status={project.status} />
            {(project as any).autoReadyMessage && (
              <Badge className="flex items-center gap-1 bg-green-600 hover:bg-green-700">
                <CheckCircle className="h-3 w-3" />
                Auto-fixed
              </Badge>
            )}

            {canRunQa && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => runQaMutation.mutate()}
                disabled={isRunningQa}
                data-testid={`button-run-qa-${project.id}`}
              >
                {isRunningQa ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <PlayCircle className="h-4 w-4 mr-1.5" />
                )}
                Run QA
              </Button>
            )}

            {canDeploy && (
              <Button
                size="sm"
                onClick={() => deployMutation.mutate()}
                disabled={isDeploying}
                data-testid={`button-deploy-${project.id}`}
              >
                {isDeploying ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4 mr-1.5" />
                )}
                Deploy
              </Button>
            )}

            {isDeployed && project.deployedUrl && (
              <Button
                size="sm"
                variant="outline"
                asChild
                data-testid={`button-view-live-${project.id}`}
              >
                <a 
                  href={project.deployedUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  View Live
                </a>
              </Button>
            )}

            <Link href={`/projects/${project.id}`}>
              <Button 
                size="icon" 
                variant="ghost"
                data-testid={`button-view-details-${project.id}`}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
