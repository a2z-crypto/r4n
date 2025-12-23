import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatsCards } from "@/components/stats-cards";
import { JobCard } from "@/components/job-card";
import { ExecutionLogTable } from "@/components/execution-log-table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Job, ExecutionLog, Stats } from "@shared/schema";

export default function Dashboard() {
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const { data: jobs = [], isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<ExecutionLog[]>({
    queryKey: ["/api/executions"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      return apiRequest("PATCH", `/api/jobs/${id}`, { status: enabled ? "active" : "paused" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });

  const runMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/jobs/${id}/run`);
    },
    onSuccess: () => {
      toast({ title: "Job started", description: "The job is now running" });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to run job", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/jobs/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Job deleted", description: "The job has been removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });

  const activeJobs = jobs.filter((j) => j.status !== "paused").slice(0, 6);

  return (
    <div className="space-y-8 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Manage your scheduled tasks and monitor executions</p>
        </div>
        <Link href="/jobs/new">
          <Button className="gap-2" data-testid="button-new-job-header">
            <Plus className="h-4 w-4" />
            New Job
          </Button>
        </Link>
      </div>

      <StatsCards stats={stats} isLoading={statsLoading} />

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Active Jobs</h2>
            <Link href="/jobs">
              <Button variant="ghost" size="sm" className="gap-1" data-testid="link-view-all-jobs">
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {jobsLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map((i) => (
                <Card key={i}>
                  <CardHeader className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-full" />
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-6 w-12" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : activeJobs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="rounded-full bg-muted p-4 mb-4">
                  <Plus className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">No active jobs</h3>
                <p className="text-sm text-muted-foreground mt-1 mb-4">
                  Create your first scheduled task to get started
                </p>
                <Link href="/jobs/new">
                  <Button data-testid="button-create-first-job">Create Job</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {activeJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onToggleStatus={(id, enabled) => toggleMutation.mutate({ id, enabled })}
                  onRunNow={(id) => runMutation.mutate(id)}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  isRunning={runMutation.isPending && runMutation.variables === job.id}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold">Recent Activity</h2>
            <Link href="/history">
              <Button variant="ghost" size="sm" className="gap-1" data-testid="link-view-all-history">
                View all <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <Card>
            <CardContent className="p-0">
              <ExecutionLogTable logs={logs} isLoading={logsLoading} limit={5} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
