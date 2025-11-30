import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ChevronDown, GitBranch, Check, X } from "lucide-react";
import { useState } from "react";
import type { PullRequest } from "@shared/schema";

interface PullRequestListProps {
  prs: PullRequest[];
  onMerge?: (prId: string) => void;
  onClose?: (prId: string) => void;
  isMerging?: string;
  isClosing?: string;
}

export function PullRequestList({
  prs,
  onMerge,
  onClose,
  isMerging,
  isClosing,
}: PullRequestListProps) {
  const [expandedPr, setExpandedPr] = useState<string | null>(null);

  if (!prs || prs.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">No pull requests yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {prs.map((pr) => (
        <Card key={pr.id} className="overflow-hidden">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <GitBranch className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="min-w-0">
                  <CardTitle className="text-base font-medium">
                    PR #{pr.prNumber}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground truncate">
                    {pr.title}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge
                  variant={pr.status === "merged" ? "default" : pr.status === "closed" ? "secondary" : "outline"}
                  className="flex items-center gap-1"
                >
                  {pr.status === "merged" ? (
                    <>
                      <Check className="h-3 w-3" />
                      Merged
                    </>
                  ) : pr.status === "closed" ? (
                    <>
                      <X className="h-3 w-3" />
                      Closed
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" />
                      Open
                    </>
                  )}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Created {format(new Date(pr.createdAt), "MMM d, yyyy HH:mm")}
              </span>
              <button
                onClick={() =>
                  setExpandedPr(expandedPr === pr.id ? null : pr.id)
                }
                className="flex items-center gap-1 hover:text-foreground transition-colors"
                data-testid={`button-expand-pr-${pr.id}`}
              >
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${
                    expandedPr === pr.id ? "rotate-180" : ""
                  }`}
                />
                Details
              </button>
            </div>

            {expandedPr === pr.id && (
              <div className="border-t pt-3 space-y-3">
                {pr.description && (
                  <div>
                    <p className="text-sm font-medium mb-1">Description</p>
                    <div className="bg-muted p-2 rounded text-xs whitespace-pre-wrap text-muted-foreground font-mono">
                      {pr.description}
                    </div>
                  </div>
                )}

                {pr.diffJson && Array.isArray(pr.diffJson) && pr.diffJson.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">
                      Changes ({pr.diffJson.length} file{pr.diffJson.length !== 1 ? "s" : ""})
                    </p>
                    <div className="space-y-2">
                      {(pr.diffJson as any[]).map((diff: any, idx: number) => (
                        <div key={idx} className="border rounded p-2 bg-muted/50 text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="capitalize">
                              {diff.change}
                            </Badge>
                            <code className="text-muted-foreground break-all">
                              {diff.file}
                            </code>
                          </div>
                          {diff.change === "modified" && diff.before && diff.after && (
                            <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                              <div className="bg-red-900/20 p-1 rounded font-mono text-muted-foreground overflow-x-auto max-h-24">
                                <div className="font-medium text-xs mb-1">Before:</div>
                                <pre>{diff.before.slice(0, 200)}</pre>
                              </div>
                              <div className="bg-green-900/20 p-1 rounded font-mono text-muted-foreground overflow-x-auto max-h-24">
                                <div className="font-medium text-xs mb-1">After:</div>
                                <pre>{diff.after.slice(0, 200)}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pr.status === "open" && (
                  <div className="flex gap-2 pt-2 border-t">
                    {onMerge && (
                      <Button
                        size="sm"
                        onClick={() => onMerge(pr.id)}
                        disabled={isMerging === pr.id}
                        data-testid={`button-merge-pr-${pr.id}`}
                      >
                        Merge
                      </Button>
                    )}
                    {onClose && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onClose(pr.id)}
                        disabled={isClosing === pr.id}
                        data-testid={`button-close-pr-${pr.id}`}
                      >
                        Close
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
