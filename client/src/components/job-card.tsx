import { useState } from "react";
import { Link } from "wouter";
import { 
  Play, 
  Pause, 
  MoreVertical, 
  Edit, 
  Trash2, 
  RefreshCw,
  Globe,
  Webhook,
  Code,
  Clock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Job } from "@shared/schema";
import cronstrue from "cronstrue";
import { formatDistanceToNow } from "date-fns";

interface JobCardProps {
  job: Job;
  onToggleStatus: (id: string, enabled: boolean) => void;
  onRunNow: (id: string) => void;
  onDelete: (id: string) => void;
  isRunning?: boolean;
}

const actionIcons = {
  http_request: Globe,
  webhook: Webhook,
  script: Code,
};

const statusStyles = {
  active: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  paused: "bg-muted text-muted-foreground border-muted",
  running: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 animate-pulse",
};

export function JobCard({ job, onToggleStatus, onRunNow, onDelete, isRunning }: JobCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  
  const ActionIcon = actionIcons[job.action.type];
  const isActive = job.status === "active";
  const currentStatus = isRunning ? "running" : job.status;

  let cronDescription = "";
  try {
    cronDescription = cronstrue.toString(job.cronExpression);
  } catch {
    cronDescription = "Invalid cron expression";
  }

  return (
    <>
      <Card 
        className={`relative overflow-visible transition-colors ${
          currentStatus === "running" ? "ring-2 ring-blue-500/50" : ""
        }`}
        data-testid={`job-card-${job.id}`}
      >
        <div 
          className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-md ${
            currentStatus === "active" 
              ? "bg-green-500" 
              : currentStatus === "running"
              ? "bg-blue-500"
              : "bg-muted-foreground/30"
          }`}
        />
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2 pl-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base font-semibold truncate">
                {job.name}
              </CardTitle>
              <Badge 
                variant="outline" 
                className={`text-xs uppercase font-medium ${statusStyles[currentStatus]}`}
                data-testid={`job-status-${job.id}`}
              >
                {currentStatus}
              </Badge>
            </div>
            {job.description && (
              <p className="text-sm text-muted-foreground mt-1 truncate">
                {job.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRunNow(job.id)}
                  disabled={isRunning}
                  data-testid={`button-run-${job.id}`}
                >
                  <RefreshCw className={`h-4 w-4 ${isRunning ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Run now</TooltipContent>
            </Tooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" data-testid={`button-menu-${job.id}`}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <Link href={`/jobs/${job.id}/edit`}>
                  <DropdownMenuItem data-testid={`menu-edit-${job.id}`}>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive focus:text-destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  data-testid={`menu-delete-${job.id}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="pl-4 space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <ActionIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground capitalize">
              {job.action.type.replace("_", " ")}
            </span>
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                {job.cronExpression}
              </code>
            </div>
            <p className="text-xs text-muted-foreground pl-6">
              {cronDescription}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="text-xs text-muted-foreground">
              {job.nextRun && isActive ? (
                <span>
                  Next: {formatDistanceToNow(new Date(job.nextRun), { addSuffix: true })}
                </span>
              ) : job.lastRun ? (
                <span>
                  Last: {formatDistanceToNow(new Date(job.lastRun), { addSuffix: true })}
                </span>
              ) : (
                <span>Never run</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isActive ? (
                <Pause className="h-3 w-3 text-muted-foreground" />
              ) : (
                <Play className="h-3 w-3 text-muted-foreground" />
              )}
              <Switch
                checked={isActive}
                onCheckedChange={(checked) => onToggleStatus(job.id, checked)}
                data-testid={`switch-toggle-${job.id}`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{job.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete(job.id);
                setShowDeleteDialog(false);
              }}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
