import { Clock, PlayCircle, AlertCircle, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Stats } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface StatsCardsProps {
  stats: Stats | undefined;
  isLoading: boolean;
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const items = [
    {
      title: "Total Jobs",
      value: stats?.totalJobs ?? 0,
      description: "Scheduled tasks",
      icon: Clock,
      testId: "stat-total-jobs",
    },
    {
      title: "Active",
      value: stats?.activeJobs ?? 0,
      description: "Currently running",
      icon: PlayCircle,
      testId: "stat-active-jobs",
    },
    {
      title: "Failed (24h)",
      value: stats?.failedLast24h ?? 0,
      description: "In last 24 hours",
      icon: AlertCircle,
      testId: "stat-failed-jobs",
    },
    {
      title: "Next Execution",
      value: stats?.nextExecution
        ? formatDistanceToNow(new Date(stats.nextExecution), { addSuffix: true })
        : "No jobs",
      description: stats?.nextExecution
        ? new Date(stats.nextExecution).toLocaleTimeString()
        : "Schedule a job",
      icon: Timer,
      testId: "stat-next-execution",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.title} data-testid={item.testId}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.title}
            </CardTitle>
            <item.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid={`${item.testId}-value`}>
              {item.value}
            </div>
            <p className="text-xs text-muted-foreground">{item.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
