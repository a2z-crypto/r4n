import { useState } from "react";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ExecutionLog } from "@shared/schema";
import { format, formatDistanceToNow } from "date-fns";

interface ExecutionLogTableProps {
  logs: ExecutionLog[];
  isLoading: boolean;
  limit?: number;
}

const statusConfig = {
  success: {
    icon: CheckCircle2,
    badge: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  },
  failure: {
    icon: XCircle,
    badge: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  },
  running: {
    icon: Loader2,
    badge: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  },
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "-";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function LogRow({ log }: { log: ExecutionLog }) {
  const [isOpen, setIsOpen] = useState(false);
  const config = statusConfig[log.status];
  const StatusIcon = config.icon;
  const hasDetails = log.output || log.error;

  return (
    <>
      <TableRow className="group" data-testid={`log-row-${log.id}`}>
        <TableCell className="w-8">
          {hasDetails && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6" 
              data-testid={`button-expand-${log.id}`}
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
        </TableCell>
        <TableCell className="font-medium">{log.jobName}</TableCell>
        <TableCell>
          <Badge variant="outline" className={`${config.badge} uppercase text-xs`}>
            <StatusIcon className={`h-3 w-3 mr-1 ${log.status === "running" ? "animate-spin" : ""}`} />
            {log.status}
          </Badge>
        </TableCell>
        <TableCell className="text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span className="text-sm">
              {formatDistanceToNow(new Date(log.startTime), { addSuffix: true })}
            </span>
          </div>
        </TableCell>
        <TableCell className="text-right font-mono text-sm text-muted-foreground">
          {formatDuration(log.duration)}
        </TableCell>
      </TableRow>
      {hasDetails && isOpen && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/50 p-0">
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <span>Started: {format(new Date(log.startTime), "PPpp")}</span>
                {log.endTime && (
                  <>
                    <span className="text-muted-foreground/50">|</span>
                    <span>Ended: {format(new Date(log.endTime), "PPpp")}</span>
                  </>
                )}
              </div>
              {log.output && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Output:</p>
                  <ScrollArea className="h-32">
                    <pre className="text-xs font-mono bg-background p-3 rounded-md border whitespace-pre-wrap">
                      {log.output}
                    </pre>
                  </ScrollArea>
                </div>
              )}
              {log.error && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-destructive">Error:</p>
                  <ScrollArea className="h-32">
                    <pre className="text-xs font-mono bg-destructive/10 text-destructive p-3 rounded-md border border-destructive/20 whitespace-pre-wrap">
                      {log.error}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function ExecutionLogTable({ logs, isLoading, limit }: ExecutionLogTableProps) {
  const displayLogs = limit ? logs.slice(0, limit) : logs;

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 p-4 border rounded-md">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-4 w-24 ml-auto" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground">No executions yet</h3>
        <p className="text-sm text-muted-foreground/80 mt-1">
          Job executions will appear here once they run
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8"></TableHead>
            <TableHead>Job Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Start Time</TableHead>
            <TableHead className="text-right">Duration</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayLogs.map((log) => (
            <LogRow key={log.id} log={log} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
