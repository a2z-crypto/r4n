import { useLocation, useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { CampaignForm } from "@/components/campaign-form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Campaign, InsertCampaign, CampaignAudience, CampaignStep } from "@shared/schema";

interface AudienceData {
  name: string;
  type: "static" | "filter" | "all_users";
  userIds?: string[];
}

interface StepData {
  name: string;
  channel: "email" | "in_app";
  templateId?: number;
  customSubject?: string;
  customContent?: string;
  delayMinutes: number;
  isActive: boolean;
}

export default function CampaignFormPage() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const isEditing = !!params.id;
  const campaignId = params.id ? parseInt(params.id) : undefined;

  const { data: campaign, isLoading: campaignLoading } = useQuery<Campaign>({
    queryKey: ["/api/campaigns", campaignId],
    enabled: isEditing,
  });

  const { data: existingAudiences = [], isLoading: audiencesLoading } = useQuery<CampaignAudience[]>({
    queryKey: ["/api/campaigns", campaignId, "audiences"],
    enabled: isEditing,
  });

  const { data: existingSteps = [], isLoading: stepsLoading } = useQuery<CampaignStep[]>({
    queryKey: ["/api/campaigns", campaignId, "steps"],
    enabled: isEditing,
  });

  const isLoading = campaignLoading || audiencesLoading || stepsLoading;

  const createMutation = useMutation({
    mutationFn: async ({ campaign, audience, steps }: { 
      campaign: InsertCampaign; 
      audience: AudienceData; 
      steps: StepData[] 
    }) => {
      const result = await apiRequest("POST", "/api/campaigns", campaign);
      const campaignData = await result.json();
      
      await apiRequest("POST", `/api/campaigns/${campaignData.id}/audiences`, audience);
      
      for (let i = 0; i < steps.length; i++) {
        await apiRequest("POST", `/api/campaigns/${campaignData.id}/steps`, {
          ...steps[i],
          stepOrder: i + 1,
        });
      }
      
      return campaignData;
    },
    onSuccess: () => {
      toast({ title: "Campaign created", description: "Your campaign has been set up" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      navigate("/campaigns");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to create campaign", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ campaign, audience, steps }: { 
      campaign: InsertCampaign; 
      audience: AudienceData; 
      steps: StepData[] 
    }) => {
      await apiRequest("PATCH", `/api/campaigns/${campaignId}`, campaign);
      
      if (existingAudiences.length > 0) {
        for (const aud of existingAudiences) {
          await apiRequest("DELETE", `/api/campaign-audiences/${aud.id}`);
        }
      }
      await apiRequest("POST", `/api/campaigns/${campaignId}/audiences`, audience);
      
      if (existingSteps.length > 0) {
        for (const step of existingSteps) {
          await apiRequest("DELETE", `/api/campaign-steps/${step.id}`);
        }
      }
      for (let i = 0; i < steps.length; i++) {
        await apiRequest("POST", `/api/campaigns/${campaignId}/steps`, {
          ...steps[i],
          stepOrder: i + 1,
        });
      }
    },
    onSuccess: () => {
      toast({ title: "Campaign updated", description: "Your changes have been saved" });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "audiences"] });
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "steps"] });
      navigate("/campaigns");
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update campaign", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = (campaignData: InsertCampaign, audience: AudienceData, steps: StepData[]) => {
    if (isEditing) {
      updateMutation.mutate({ campaign: campaignData, audience, steps });
    } else {
      createMutation.mutate({ campaign: campaignData, audience, steps });
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
        <Button variant="ghost" size="icon" onClick={() => navigate("/campaigns")} data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? "Edit Campaign" : "Create Campaign"}
          </h1>
          <p className="text-muted-foreground">
            {isEditing ? "Update your campaign settings" : "Set up a new multi-stage notification campaign"}
          </p>
        </div>
      </div>

      <CampaignForm
        initialData={campaign}
        initialAudience={existingAudiences[0]}
        initialSteps={existingSteps}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
