import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { JobForm } from "@/components/job-form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Job, InsertJob } from "@shared/schema";

export default function JobFormPage() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isEditing = !!params.id;

  const { data: job, isLoading } = useQuery<Job>({
    queryKey: ["/api/jobs", params.id],
    enabled: isEditing,
  });

  const createMutation = useMutation({
    mutationFn: async (data: InsertJob) => {
      return apiRequest("POST", "/api/jobs", data);
    },
    onSuccess: () => {
      toast({ title: "Job created", description: "Your job has been scheduled" });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      navigate("/jobs");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create job", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: InsertJob) => {
      return apiRequest("PATCH", `/api/jobs/${params.id}`, data);
    },
    onSuccess: () => {
      toast({ title: "Job updated", description: "Your changes have been saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", params.id] });
      navigate("/jobs");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update job", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (data: InsertJob) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (isEditing && isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/jobs")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? "Edit Job" : "Create Job"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "Update your scheduled task" : "Set up a new scheduled task"}
          </p>
        </div>
      </div>

      <JobForm
        initialData={job}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
