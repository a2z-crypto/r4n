import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Play, Trash2, Edit, GitBranch, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { WorkflowBuilder, type WorkflowStep } from "@/components/workflow-builder";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import type { DbWorkflow, DbWorkflowStep, DbWorkflowExecution } from "@shared/schema";

export default function WorkflowsPage() {
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<{
    workflow: DbWorkflow;
    steps: DbWorkflowStep[];
  } | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: workflows = [], isLoading } = useQuery<DbWorkflow[]>({
    queryKey: ["/api/workflows"],
  });

  const { data: executions = [] } = useQuery<DbWorkflowExecution[]>({
    queryKey: ["/api/workflow-executions"],
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      description: string;
      cronExpression: string | null;
      steps: Omit<WorkflowStep, "id">[];
    }) => apiRequest("POST", "/api/workflows", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      setIsCreateOpen(false);
      toast({ title: "Success", description: "Workflow created successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      apiRequest("PATCH", `/api/workflows/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      setEditingWorkflow(null);
      toast({ title: "Success", description: "Workflow updated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/workflows/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflows"] });
      setDeleteId(null);
      toast({ title: "Success", description: "Workflow deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const runMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/workflows/${id}/run`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workflow-executions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/executions"] });
      toast({ title: "Success", description: "Workflow execution started" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const generateWebhookMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/workflows/${id}/webhook`),
    onSuccess: async (_, id) => {
      const data = await fetchWorkflowDetails(id);
      setEditingWorkflow(data);
      toast({ title: "Success", description: "Webhook URL generated" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const revokeWebhookMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/workflows/${id}/webhook`),
    onSuccess: async (_, id) => {
      const data = await fetchWorkflowDetails(id);
      setEditingWorkflow(data);
      toast({ title: "Success", description: "Webhook URL revoked" });
    },
    onError: (error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const fetchWorkflowDetails = async (id: number) => {
    const response = await fetch(`/api/workflows/${id}`);
    const data = await response.json();
    return data as { workflow: DbWorkflow; steps: DbWorkflowStep[] };
  };

  const handleEdit = async (workflowId: number) => {
    const data = await fetchWorkflowDetails(workflowId);
    setEditingWorkflow(data);
  };

  const getExecutionStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "running":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return null;
    }
  };

  const getRecentExecution = (workflowId: number) => {
    return executions.find((e) => e.workflowId === workflowId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Workflows</h1>
          <p className="text-muted-foreground">
            Create multi-step workflows that chain API calls and scripts together
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} data-testid="button-create-workflow">
          <Plus className="h-4 w-4 mr-2" />
          New Workflow
        </Button>
      </div>

      {workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GitBranch className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first workflow to chain multiple API calls together.
              <br />
              For example: fetch users, then process each user with another API.
            </p>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {workflows.map((workflow) => {
            const recentExecution = getRecentExecution(workflow.id);
            return (
              <Card key={workflow.id} data-testid={`card-workflow-${workflow.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{workflow.name}</CardTitle>
                      {workflow.description && (
                        <CardDescription className="line-clamp-2">
                          {workflow.description}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant={workflow.status === "active" ? "default" : "secondary"}>
                      {workflow.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {workflow.cronExpression ? (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{workflow.cronExpression}</span>
                      </div>
                    ) : (
                      <span className="italic">Manual execution only</span>
                    )}
                  </div>

                  {recentExecution && (
                    <div className="flex items-center gap-2 text-sm">
                      {getExecutionStatusIcon(recentExecution.status)}
                      <span>
                        Last run {formatDistanceToNow(new Date(recentExecution.startTime))} ago
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => runMutation.mutate(workflow.id)}
                      disabled={runMutation.isPending}
                      data-testid={`button-run-workflow-${workflow.id}`}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Run
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(workflow.id)}
                      data-testid={`button-edit-workflow-${workflow.id}`}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(workflow.id)}
                      data-testid={`button-delete-workflow-${workflow.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Workflow</DialogTitle>
            <DialogDescription>
              Build a multi-step workflow that chains API calls and data transformations
            </DialogDescription>
          </DialogHeader>
          <WorkflowBuilder
            onSave={(data) => createMutation.mutate(data)}
            onCancel={() => setIsCreateOpen(false)}
            isSaving={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingWorkflow}
        onOpenChange={(open) => !open && setEditingWorkflow(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Workflow</DialogTitle>
            <DialogDescription>
              Modify your workflow steps and configuration
            </DialogDescription>
          </DialogHeader>
          {editingWorkflow && (
            <WorkflowBuilder
              workflowId={editingWorkflow.workflow.id}
              initialName={editingWorkflow.workflow.name}
              initialDescription={editingWorkflow.workflow.description || ""}
              initialCronExpression={editingWorkflow.workflow.cronExpression || ""}
              initialTriggerType={(editingWorkflow.workflow.triggerType as "manual" | "cron" | "webhook") || "manual"}
              webhookToken={editingWorkflow.workflow.webhookToken || undefined}
              webhookUrl={editingWorkflow.workflow.webhookToken ? `/api/webhooks/${editingWorkflow.workflow.webhookToken}` : undefined}
              initialSteps={editingWorkflow.steps.map((s) => ({
                id: String(s.id),
                name: s.name,
                stepType: (s.stepType as "action" | "condition") || "action",
                action: s.action as WorkflowStep["action"],
                inputMapping: s.inputMapping as Record<string, string> | undefined,
                outputVariable: s.outputVariable || undefined,
                condition: s.condition as WorkflowStep["condition"],
                onTrueStep: s.onTrueStep,
                onFalseStep: s.onFalseStep,
              }))}
              onSave={(data) =>
                updateMutation.mutate({
                  id: editingWorkflow.workflow.id,
                  data: {
                    name: data.name,
                    description: data.description,
                    cronExpression: data.cronExpression,
                    triggerType: data.triggerType,
                    steps: data.steps,
                  },
                })
              }
              onCancel={() => setEditingWorkflow(null)}
              onGenerateWebhook={() => generateWebhookMutation.mutate(editingWorkflow.workflow.id)}
              onRevokeWebhook={() => revokeWebhookMutation.mutate(editingWorkflow.workflow.id)}
              isSaving={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workflow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this workflow? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
