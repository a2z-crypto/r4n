import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  ArrowLeft, Play, Pause, XCircle, Edit, RefreshCw, 
  Clock, Users, Mail, CheckCircle, AlertCircle, BarChart3,
  TrendingUp, TrendingDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Campaign, CampaignStep, CampaignRun, CampaignAudience } from "@shared/schema";
import { formatDistanceToNow, format } from "date-fns";

function getStatusColor(status: string) {
  switch (status) {
    case "draft":
      return "secondary";
    case "scheduled":
      return "outline";
    case "running":
      return "default";
    case "paused":
      return "secondary";
    case "completed":
      return "default";
    case "cancelled":
      return "destructive";
    case "pending":
      return "outline";
    case "success":
      return "default";
    case "failed":
      return "destructive";
    default:
      return "secondary";
  }
}

function StatCard({ 
  title, 
  value, 
  description, 
  icon: Icon,
  trend 
}: { 
  title: string; 
  value: string | number; 
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down";
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {trend && (
            <span className={`flex items-center text-sm ${trend === "up" ? "text-green-600" : "text-red-600"}`}>
              {trend === "up" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            </span>
          )}
        </div>
        {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

export default function CampaignDetail() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const campaignId = parseInt(params.id);

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
  });

  const { data: steps = [] } = useQuery<CampaignStep[]>({
    queryKey: ["/api/campaigns", campaignId, "steps"],
    enabled: !!campaignId,
  });

  const { data: audiences = [] } = useQuery<CampaignAudience[]>({
    queryKey: ["/api/campaigns", campaignId, "audiences"],
    enabled: !!campaignId,
  });

  const { data: runs = [] } = useQuery<CampaignRun[]>({
    queryKey: ["/api/campaign-runs", { campaignId }],
    enabled: !!campaignId,
  });

  const launchMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/launch`);
    },
    onSuccess: () => {
      toast({ title: "Campaign launched", description: "The campaign is now running" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to launch campaign", description: error.message, variant: "destructive" });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/pause`);
    },
    onSuccess: () => {
      toast({ title: "Campaign paused", description: "The campaign has been paused" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/cancel`);
    },
    onSuccess: () => {
      toast({ title: "Campaign cancelled", description: "The campaign has been cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
    },
  });

  const runNowMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/campaigns/${campaignId}/run`);
    },
    onSuccess: () => {
      toast({ title: "Campaign run started", description: "A new run has been initiated" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaign-runs", { campaignId }] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to run campaign", description: error.message, variant: "destructive" });
    },
  });

  if (campaignLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-medium">Campaign not found</h2>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/campaigns")}>
            Back to Campaigns
          </Button>
        </div>
      </div>
    );
  }

  const latestRun = runs[0];
  const totalSent = runs.reduce((sum, run) => sum + (run.sentCount || 0), 0);
  const totalDelivered = runs.reduce((sum, run) => sum + (run.deliveredCount || 0), 0);
  const totalFailed = runs.reduce((sum, run) => sum + (run.failedCount || 0), 0);
  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/campaigns")} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1>
              <Badge variant={getStatusColor(campaign.status)} className="capitalize">
                {campaign.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">{campaign.description || "No description"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {campaign.status === "draft" && (
            <>
              <Button variant="outline" onClick={() => navigate(`/campaigns/${campaignId}/edit`)} data-testid="button-edit">
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button onClick={() => launchMutation.mutate()} disabled={launchMutation.isPending} data-testid="button-launch">
                <Play className="h-4 w-4 mr-2" />
                Launch
              </Button>
            </>
          )}
          {campaign.status === "paused" && (
            <Button onClick={() => launchMutation.mutate()} disabled={launchMutation.isPending} data-testid="button-resume">
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
          )}
          {campaign.status === "running" && (
            <Button variant="outline" onClick={() => pauseMutation.mutate()} disabled={pauseMutation.isPending} data-testid="button-pause">
              <Pause className="h-4 w-4 mr-2" />
              Pause
            </Button>
          )}
          {(campaign.status === "running" || campaign.status === "paused") && (
            <Button variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending} data-testid="button-cancel">
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          )}
          {campaign.scheduleType === "manual" && campaign.status !== "cancelled" && campaign.status !== "completed" && (
            <Button variant="secondary" onClick={() => runNowMutation.mutate()} disabled={runNowMutation.isPending} data-testid="button-run-now">
              <RefreshCw className="h-4 w-4 mr-2" />
              Run Now
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          title="Total Sent"
          value={totalSent}
          icon={Mail}
          description={`${runs.length} campaign runs`}
        />
        <StatCard
          title="Delivered"
          value={totalDelivered}
          icon={CheckCircle}
          description={`${deliveryRate}% delivery rate`}
          trend={deliveryRate >= 95 ? "up" : deliveryRate < 90 ? "down" : undefined}
        />
        <StatCard
          title="Failed"
          value={totalFailed}
          icon={AlertCircle}
          description={totalFailed === 0 ? "No failures" : "Check logs for details"}
          trend={totalFailed > 0 ? "down" : undefined}
        />
        <StatCard
          title="Audience"
          value={audiences.reduce((sum, a) => sum + (a.estimatedCount || 0), 0)}
          icon={Users}
          description={`${audiences.length} audience segment(s)`}
        />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="runs">Run History</TabsTrigger>
          <TabsTrigger value="steps">Steps</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Campaign Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Schedule Type</span>
                  <span className="font-medium capitalize">{campaign.scheduleType?.replace("_", " ")}</span>
                </div>
                {campaign.cronExpression && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Schedule</span>
                    <span className="font-medium font-mono text-sm">{campaign.cronExpression}</span>
                  </div>
                )}
                {campaign.scheduledAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Scheduled For</span>
                    <span className="font-medium">{format(new Date(campaign.scheduledAt), "PPp")}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">{formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true })}</span>
                </div>
                {campaign.startedAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Started</span>
                    <span className="font-medium">{formatDistanceToNow(new Date(campaign.startedAt), { addSuffix: true })}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Throttle Limit</span>
                  <span className="font-medium">{campaign.throttleLimit} / {Math.round((campaign.throttleInterval || 3600) / 60)} min</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Latest Run</CardTitle>
              </CardHeader>
              <CardContent>
                {latestRun ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={getStatusColor(latestRun.status)} className="capitalize">
                        {latestRun.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Started</span>
                      <span className="font-medium">
                        {latestRun.startedAt ? formatDistanceToNow(new Date(latestRun.startedAt), { addSuffix: true }) : "Not started"}
                      </span>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>
                          {latestRun.sentCount || 0} / {latestRun.totalRecipients || 0}
                        </span>
                      </div>
                      <Progress 
                        value={latestRun.totalRecipients ? ((latestRun.sentCount || 0) / latestRun.totalRecipients) * 100 : 0} 
                      />
                    </div>
                    {latestRun.error && (
                      <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                        {latestRun.error}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2" />
                    <p>No runs yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="runs">
          <Card>
            <CardHeader>
              <CardTitle>Run History</CardTitle>
              <CardDescription>Previous executions of this campaign</CardDescription>
            </CardHeader>
            <CardContent>
              {runs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4" />
                  <p>No runs yet. Launch the campaign to see execution history.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Run ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead>Recipients</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Failed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => (
                      <TableRow key={run.id}>
                        <TableCell className="font-mono text-sm">#{run.id}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(run.status)} className="capitalize">
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {run.startedAt 
                            ? formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })
                            : "-"
                          }
                        </TableCell>
                        <TableCell>{run.totalRecipients || 0}</TableCell>
                        <TableCell>{run.sentCount || 0}</TableCell>
                        <TableCell className={run.failedCount ? "text-destructive" : ""}>
                          {run.failedCount || 0}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="steps">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Steps</CardTitle>
              <CardDescription>Sequence of messages in this campaign</CardDescription>
            </CardHeader>
            <CardContent>
              {steps.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4" />
                  <p>No steps configured</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {steps.sort((a, b) => a.stepOrder - b.stepOrder).map((step, index) => (
                    <Card key={step.id} className={`border-l-4 ${step.isActive ? "border-l-primary" : "border-l-muted"}`}>
                      <CardContent className="flex items-center gap-4 py-4">
                        <Badge variant="outline" className="shrink-0">{index + 1}</Badge>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{step.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {step.channel === "email" ? "Email" : "In-App"} 
                            {(step.delayMinutes || 0) > 0 && ` - ${step.delayMinutes} min delay`}
                          </p>
                        </div>
                        {!step.isActive && <Badge variant="secondary">Disabled</Badge>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audience">
          <Card>
            <CardHeader>
              <CardTitle>Target Audience</CardTitle>
              <CardDescription>Recipients for this campaign</CardDescription>
            </CardHeader>
            <CardContent>
              {audiences.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4" />
                  <p>No audience configured</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {audiences.map((audience) => (
                    <Card key={audience.id}>
                      <CardContent className="flex items-center justify-between py-4">
                        <div>
                          <p className="font-medium">{audience.name}</p>
                          <p className="text-sm text-muted-foreground capitalize">{audience.type.replace("_", " ")}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{audience.estimatedCount || 0}</p>
                          <p className="text-sm text-muted-foreground">recipients</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
