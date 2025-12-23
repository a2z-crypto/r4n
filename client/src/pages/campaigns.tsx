import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Filter, Play, Pause, XCircle, MoreHorizontal, Mail, Users, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Campaign } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

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
    default:
      return "secondary";
  }
}

export default function Campaigns() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/campaigns"],
  });

  const launchMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/campaigns/${id}/launch`);
    },
    onSuccess: () => {
      toast({ title: "Campaign launched", description: "The campaign is now running" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to launch campaign", description: error.message, variant: "destructive" });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/campaigns/${id}/pause`);
    },
    onSuccess: () => {
      toast({ title: "Campaign paused", description: "The campaign has been paused" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to pause campaign", description: error.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("POST", `/api/campaigns/${id}/cancel`);
    },
    onSuccess: () => {
      toast({ title: "Campaign cancelled", description: "The campaign has been cancelled" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/campaigns/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Campaign deleted", description: "The campaign has been removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete campaign", description: error.message, variant: "destructive" });
    },
  });

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesSearch = campaign.name.toLowerCase().includes(search.toLowerCase()) ||
      (campaign.description?.toLowerCase().includes(search.toLowerCase()) ?? false);
    const matchesStatus = statusFilter === "all" || campaign.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Campaigns</h1>
          <p className="text-muted-foreground">Manage multi-stage notification campaigns</p>
        </div>
        <Link href="/campaigns/new">
          <Button className="gap-2" data-testid="button-new-campaign">
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
            data-testid="input-search-campaigns"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No campaigns found</h3>
            <p className="text-muted-foreground text-center mb-4">
              {search || statusFilter !== "all" 
                ? "Try adjusting your filters"
                : "Create your first campaign to start reaching your audience"}
            </p>
            {!search && statusFilter === "all" && (
              <Link href="/campaigns/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Campaign
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCampaigns.map((campaign) => (
            <Card key={campaign.id} className="hover-elevate cursor-pointer" onClick={() => setLocation(`/campaigns/${campaign.id}`)}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base font-semibold truncate">{campaign.name}</CardTitle>
                  <CardDescription className="truncate">{campaign.description || "No description"}</CardDescription>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Badge variant={getStatusColor(campaign.status)} className="capitalize">
                    {campaign.status}
                  </Badge>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`button-campaign-menu-${campaign.id}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setLocation(`/campaigns/${campaign.id}`)}>
                        <BarChart3 className="h-4 w-4 mr-2" />
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setLocation(`/campaigns/${campaign.id}/edit`)}>
                        Edit Campaign
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {campaign.status === "draft" && (
                        <DropdownMenuItem onClick={() => launchMutation.mutate(campaign.id)}>
                          <Play className="h-4 w-4 mr-2" />
                          Launch Campaign
                        </DropdownMenuItem>
                      )}
                      {campaign.status === "paused" && (
                        <DropdownMenuItem onClick={() => launchMutation.mutate(campaign.id)}>
                          <Play className="h-4 w-4 mr-2" />
                          Resume Campaign
                        </DropdownMenuItem>
                      )}
                      {campaign.status === "running" && (
                        <DropdownMenuItem onClick={() => pauseMutation.mutate(campaign.id)}>
                          <Pause className="h-4 w-4 mr-2" />
                          Pause Campaign
                        </DropdownMenuItem>
                      )}
                      {(campaign.status === "running" || campaign.status === "paused") && (
                        <DropdownMenuItem onClick={() => cancelMutation.mutate(campaign.id)}>
                          <XCircle className="h-4 w-4 mr-2" />
                          Cancel Campaign
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => setDeleteId(campaign.id)}
                        disabled={campaign.status === "running"}
                      >
                        Delete Campaign
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Users className="h-4 w-4" />
                    <span>{campaign.scheduleType}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    <span>
                      {campaign.createdAt && formatDistanceToNow(new Date(campaign.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this campaign? This action cannot be undone.
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
