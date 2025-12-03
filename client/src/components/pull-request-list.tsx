import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import { ChevronDown, GitBranch, Check, X, GitPullRequest, FileCode, ArrowRight } from "lucide-react";
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
      <Card className="border-dashed border-2 bg-muted/10 shadow-none">
        <CardContent className="pt-12 pb-12 flex flex-col items-center justify-center text-center">
          <div className="p-4 rounded-full bg-muted/30 mb-4">
            <GitPullRequest className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-medium text-muted-foreground">No pull requests yet</h3>
          <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
            When the AI fixes issues or generates code, pull requests will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {prs.map((pr) => (
        <Card 
          key={pr.id} 
          className={`overflow-hidden border transition-all duration-300 ${
            pr.status === "open" 
              ? "border-purple-200 dark:border-purple-900/30 shadow-sm" 
              : "border-muted/60 opacity-80"
          }`}
        >
          <CardHeader className="pb-3 bg-card">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`mt-1 p-1.5 rounded-md ${
                  pr.status === "open" ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" :
                  pr.status === "merged" ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" :
                  "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}>
                  <GitBranch className="h-4 w-4" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base font-semibold text-foreground">
                      {pr.title}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground font-mono">#{pr.prNumber}</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    Created {format(new Date(pr.createdAt), "MMM d, yyyy 'at' HH:mm")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge
                  variant="outline"
                  className={`flex items-center gap-1.5 px-2.5 py-1 ${
                    pr.status === "open" ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-300 dark:border-purple-800/50" :
                    pr.status === "merged" ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800/50" :
                    "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900/50 dark:text-slate-400 dark:border-slate-800"
                  }`}
                >
                  {pr.status === "merged" ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Merged
                    </>
                  ) : pr.status === "closed" ? (
                    <>
                      <X className="h-3.5 w-3.5" />
                      Closed
                    </>
                  ) : (
                    <>
                      <GitPullRequest className="h-3.5 w-3.5" />
                      Open
                    </>
                  )}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div 
              className={`transition-all duration-300 ease-in-out overflow-hidden ${
                expandedPr === pr.id ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
              }`}
            >
              <div className="p-4 pt-0 space-y-4 border-t bg-muted/5">
                {pr.description && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Description</p>
                    <div className="bg-card border p-3 rounded-lg text-sm text-muted-foreground leading-relaxed">
                      {pr.description}
                    </div>
                  </div>
                )}

                {pr.diffJson && Array.isArray(pr.diffJson) && pr.diffJson.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        File Changes ({pr.diffJson.length})
                      </p>
                    </div>
                    <div className="space-y-3">
                      {(pr.diffJson as any[]).map((diff: any, idx: number) => (
                        <div key={idx} className="border rounded-lg overflow-hidden bg-card shadow-sm">
                          <div className="flex items-center gap-2 p-2 bg-muted/30 border-b">
                            <FileCode className="h-4 w-4 text-muted-foreground" />
                            <code className="text-xs font-mono text-foreground flex-1">
                              {diff.file}
                            </code>
                            <Badge variant="outline" className="text-[10px] h-5">
                              {diff.change}
                            </Badge>
                          </div>
                          
                          {diff.change === "modified" && diff.before && diff.after && (
                            <div className="grid grid-cols-2 divide-x text-xs font-mono">
                              <div className="bg-red-50/50 dark:bg-red-900/10 p-2 overflow-x-auto">
                                <div className="text-red-500/70 mb-1 select-none font-sans font-semibold text-[10px]">ORIGINAL</div>
                                <pre className="text-red-700 dark:text-red-300 whitespace-pre-wrap">{diff.before.slice(0, 300)}{diff.before.length > 300 && "..."}</pre>
                              </div>
                              <div className="bg-green-50/50 dark:bg-green-900/10 p-2 overflow-x-auto">
                                <div className="text-green-500/70 mb-1 select-none font-sans font-semibold text-[10px]">MODIFIED</div>
                                <pre className="text-green-700 dark:text-green-300 whitespace-pre-wrap">{diff.after.slice(0, 300)}{diff.after.length > 300 && "..."}</pre>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pr.status === "open" && (
                  <div className="flex gap-3 pt-4 border-t mt-4">
                    {onMerge && (
                      <Button
                        onClick={() => onMerge(pr.id)}
                        disabled={isMerging === pr.id}
                        className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm flex-1 sm:flex-none"
                        data-testid={`button-merge-pr-${pr.id}`}
                      >
                        <GitBranch className="h-4 w-4 mr-2" />
                        Merge Pull Request
                      </Button>
                    )}
                    {onClose && (
                      <Button
                        variant="outline"
                        onClick={() => onClose(pr.id)}
                        disabled={isClosing === pr.id}
                        className="flex-1 sm:flex-none"
                        data-testid={`button-close-pr-${pr.id}`}
                      >
                        Close
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Toggle Button Area */}
            <button
              onClick={() => setExpandedPr(expandedPr === pr.id ? null : pr.id)}
              className="w-full flex items-center justify-center gap-2 p-2 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors border-t"
            >
              {expandedPr === pr.id ? "Show Less" : "Show Details & Changes"}
              <ChevronDown
                className={`h-3 w-3 transition-transform duration-300 ${expandedPr === pr.id ? "rotate-180" : ""}`}
              />
            </button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
