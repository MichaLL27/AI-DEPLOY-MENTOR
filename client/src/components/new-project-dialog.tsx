import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { insertProjectSchema, type InsertProject, sourceTypeValues } from "@shared/schema";
import { useState, useRef } from "react";
import { ChevronDown, Upload } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SiGithub, SiReplit } from "react-icons/si";
import { FileArchive, Globe, Loader2 } from "lucide-react";

interface NewProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type IconComponent = React.ComponentType<{ className?: string }>;

const sourceTypeLabels: Record<string, { label: string; icon: IconComponent; placeholder: string }> = {
  github: { 
    label: "GitHub", 
    icon: SiGithub, 
    placeholder: "https://github.com/username/repo" 
  },
  replit: { 
    label: "Replit", 
    icon: SiReplit, 
    placeholder: "https://replit.com/@username/project" 
  },
  zip: { 
    label: "ZIP Archive", 
    icon: FileArchive, 
    placeholder: "https://example.com/project.zip" 
  },
  other: { 
    label: "Other", 
    icon: Globe, 
    placeholder: "https://example.com/source" 
  },
};

export function NewProjectDialog({ open, onOpenChange }: NewProjectDialogProps) {
  const { toast } = useToast();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useZipUpload, setUseZipUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<InsertProject>({
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      name: "",
      sourceType: "github",
      sourceValue: "",
      renderServiceId: "",
      renderDashboardUrl: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertProject) => {
      const response = await apiRequest("POST", "/api/projects", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "Project created",
        description: "Your project has been registered successfully.",
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create project",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const zipUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      if (form.getValues("name")) {
        formData.append("name", form.getValues("name"));
      }

      const response = await fetch("/api/projects/upload-zip", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      toast({
        title: "ZIP uploaded and analyzed",
        description: "Your project has been created and analyzed successfully.",
      });
      form.reset();
      setSelectedFile(null);
      setUseZipUpload(false);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to upload ZIP",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertProject) => {
    if (useZipUpload && selectedFile) {
      zipUploadMutation.mutate(selectedFile);
    } else {
      createMutation.mutate(data);
    }
  };

  const selectedSourceType = form.watch("sourceType");
  const sourceConfig = sourceTypeLabels[selectedSourceType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold tracking-tight">
            Register New Project
          </DialogTitle>
          <DialogDescription>
            Add your project source and we'll help you run QA checks and deploy it.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 flex gap-2">
          <Button
            type="button"
            variant={!useZipUpload ? "default" : "outline"}
            onClick={() => setUseZipUpload(false)}
            className="flex-1"
            data-testid="button-source-mode"
          >
            Source URL
          </Button>
          <Button
            type="button"
            variant={useZipUpload ? "default" : "outline"}
            onClick={() => setUseZipUpload(true)}
            className="flex-1"
            data-testid="button-zip-mode"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload ZIP
          </Button>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={useZipUpload ? "My ZIP Project" : "My Awesome App"}
                      data-testid="input-project-name"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    A descriptive name for your project.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {useZipUpload ? (
              <FormItem>
                <FormLabel>ZIP File</FormLabel>
                <FormControl>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                      data-testid="button-select-zip"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {selectedFile ? selectedFile.name : "Select ZIP File"}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".zip"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="hidden"
                      data-testid="input-zip-file"
                    />
                  </div>
                </FormControl>
                <FormDescription>
                  Upload a ZIP file of your project. Max 50MB.
                </FormDescription>
                {!selectedFile && <FormMessage>Please select a ZIP file</FormMessage>}
              </FormItem>
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="sourceType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-source-type">
                            <SelectValue placeholder="Select source type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sourceTypeValues.map((type) => {
                            const config = sourceTypeLabels[type];
                            const Icon = config.icon;
                            return (
                              <SelectItem 
                                key={type} 
                                value={type}
                                data-testid={`option-source-${type}`}
                              >
                                <div className="flex items-center gap-2">
                                  <Icon className="h-4 w-4" />
                                  {config.label}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sourceValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Source URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={sourceConfig.placeholder}
                          data-testid="input-source-value"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The URL or path to your project source code.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <div className="border-t pt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-sm font-medium hover:text-foreground text-muted-foreground transition-colors"
                data-testid="button-toggle-advanced"
              >
                <ChevronDown 
                  className={`h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                />
                Advanced (Optional)
              </button>
              
              {showAdvanced && (
                <div className="space-y-4 mt-4 pt-4 border-t">
                  <FormField
                    control={form.control}
                    name="renderServiceId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Render Service ID</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="srv-xxxxx"
                            data-testid="input-render-service-id"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Your Render service ID for real deployment integration (optional).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="renderDashboardUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Render Dashboard URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://dashboard.render.com/d/srv-xxxxx"
                            data-testid="input-render-dashboard-url"
                            {...field}
                            value={field.value || ""}
                          />
                        </FormControl>
                        <FormDescription>
                          Direct link to your Render dashboard for this service (optional).
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={useZipUpload ? (zipUploadMutation.isPending || !selectedFile) : createMutation.isPending}
                data-testid="button-register-project"
              >
                {(createMutation.isPending || zipUploadMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {useZipUpload ? "Upload ZIP" : "Register Project"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
