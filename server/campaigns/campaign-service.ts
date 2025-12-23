import { storage } from "../storage";
import { notificationService } from "../notifications/notification-service";
import type { Campaign, CampaignStep, CampaignRun } from "@shared/schema";
import * as cron from "node-cron";

class CampaignService {
  private scheduledCampaigns: Map<number, cron.ScheduledTask> = new Map();

  async initScheduler() {
    const runningCampaigns = await storage.getCampaigns("running");
    const scheduledCampaigns = await storage.getCampaigns("scheduled");
    
    for (const campaign of [...runningCampaigns, ...scheduledCampaigns]) {
      if (campaign.scheduleType === "recurring" && campaign.cronExpression) {
        this.scheduleCampaign(campaign);
      }
    }
    console.log(`[CampaignService] Initialized ${this.scheduledCampaigns.size} scheduled campaigns`);
  }

  scheduleCampaign(campaign: Campaign) {
    if (!campaign.cronExpression) return;
    
    if (this.scheduledCampaigns.has(campaign.id)) {
      this.unscheduleCampaign(campaign.id);
    }

    try {
      const task = cron.schedule(campaign.cronExpression, async () => {
        console.log(`[CampaignService] Running scheduled campaign: ${campaign.name}`);
        await this.executeCampaign(campaign.id);
      });
      
      this.scheduledCampaigns.set(campaign.id, task);
      console.log(`[CampaignService] Scheduled campaign: ${campaign.name} with cron: ${campaign.cronExpression}`);
    } catch (error) {
      console.error(`[CampaignService] Failed to schedule campaign ${campaign.id}:`, error);
    }
  }

  unscheduleCampaign(campaignId: number) {
    const task = this.scheduledCampaigns.get(campaignId);
    if (task) {
      task.stop();
      this.scheduledCampaigns.delete(campaignId);
      console.log(`[CampaignService] Unscheduled campaign: ${campaignId}`);
    }
  }

  async executeCampaign(campaignId: number): Promise<CampaignRun | null> {
    const details = await storage.getCampaignWithDetails(campaignId);
    if (!details) {
      console.error(`[CampaignService] Campaign ${campaignId} not found`);
      return null;
    }

    const { campaign, audiences, steps } = details;

    if (!steps.length) {
      console.error(`[CampaignService] Campaign ${campaignId} has no steps`);
      return null;
    }

    const recipients = await this.collectRecipients(audiences.map(a => a.id));
    
    const run = await storage.createCampaignRun({
      campaignId,
      status: "running",
      startedAt: new Date(),
      totalRecipients: recipients.length,
    });

    console.log(`[CampaignService] Started run ${run.id} for campaign ${campaign.name} with ${recipients.length} recipients`);

    try {
      await this.processSteps(run.id, steps, recipients);
      
      const stats = await this.calculateRunStats(run.id);
      await storage.updateCampaignRun(run.id, {
        status: "completed",
        completedAt: new Date(),
        ...stats,
      });

      if (campaign.scheduleType === "one-time") {
        await storage.updateCampaignStatus(campaignId, "completed");
      }

      console.log(`[CampaignService] Completed run ${run.id}`);
      return await storage.getCampaignRun(run.id);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await storage.updateCampaignRun(run.id, {
        status: "failed",
        completedAt: new Date(),
        error: errorMessage,
      });
      console.error(`[CampaignService] Run ${run.id} failed:`, error);
      return await storage.getCampaignRun(run.id);
    }
  }

  private async collectRecipients(audienceIds: number[]): Promise<{ email: string; userId?: string; metadata?: Record<string, unknown> }[]> {
    const allMembers: { email: string; userId?: string; metadata?: Record<string, unknown> }[] = [];
    
    for (const audienceId of audienceIds) {
      const audience = await storage.getCampaignAudience(audienceId);
      if (!audience) continue;

      if (audience.type === "all_users") {
        const users = await storage.getUsers();
        for (const user of users) {
          if (user.email && !allMembers.some(m => m.email === user.email)) {
            allMembers.push({ email: user.email, userId: user.id });
          }
        }
      } else {
        const members = await storage.getAudienceMembers(audienceId);
        for (const member of members) {
          if (!allMembers.some(m => m.email === member.email)) {
            allMembers.push({ 
              email: member.email, 
              userId: member.userId || undefined,
              metadata: member.metadata as Record<string, unknown> | undefined 
            });
          }
        }
      }
    }

    return allMembers;
  }

  private async processSteps(
    runId: number, 
    steps: CampaignStep[], 
    recipients: { email: string; userId?: string; metadata?: Record<string, unknown> }[]
  ) {
    const sortedSteps = [...steps].sort((a, b) => a.stepOrder - b.stepOrder);

    for (const step of sortedSteps) {
      if (!step.isActive) continue;

      if (step.delayMinutes && step.delayMinutes > 0) {
        console.log(`[CampaignService] Waiting ${step.delayMinutes} minutes before step ${step.name}`);
        await this.delay(step.delayMinutes * 60 * 1000);
      }

      await this.processStep(runId, step, recipients);
    }
  }

  private async processStep(
    runId: number, 
    step: CampaignStep, 
    recipients: { email: string; userId?: string; metadata?: Record<string, unknown> }[]
  ) {
    console.log(`[CampaignService] Processing step: ${step.name} for ${recipients.length} recipients`);

    for (const recipient of recipients) {
      const recipientRecord = await storage.createCampaignRecipient({
        runId,
        stepId: step.id,
        email: recipient.email,
        userId: recipient.userId || null,
        status: "pending",
        metadata: recipient.metadata || {},
      });

      try {
        if (step.channel === "email") {
          await this.sendEmail(step, recipient);
          await storage.updateCampaignRecipient(recipientRecord.id, {
            status: "sent",
            sentAt: new Date(),
          });
        } else if (step.channel === "in_app") {
          await this.sendInAppNotification(step, recipient);
          await storage.updateCampaignRecipient(recipientRecord.id, {
            status: "sent",
            sentAt: new Date(),
          });
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await storage.updateCampaignRecipient(recipientRecord.id, {
          status: "failed",
          error: errorMessage,
        });
      }
    }
  }

  private async sendEmail(
    step: CampaignStep, 
    recipient: { email: string; userId?: string; metadata?: Record<string, unknown> }
  ) {
    let subject = step.customSubject || "";
    let content = step.customContent || "";

    if (step.templateId) {
      const template = await storage.getNotificationTemplate(step.templateId);
      if (template) {
        const rendered = notificationService.renderTemplate(template, recipient.metadata || {});
        subject = rendered.subject || subject;
        content = rendered.content;
      }
    }

    const notification = await storage.createNotification({
      channel: "email",
      recipientEmail: recipient.email,
      recipientId: recipient.userId || null,
      subject,
      content,
      status: "pending",
      templateId: step.templateId || null,
      variables: recipient.metadata || {},
      scheduledFor: null,
    });

    await notificationService.deliverNotification(notification);
  }

  private async sendInAppNotification(
    step: CampaignStep, 
    recipient: { email: string; userId?: string; metadata?: Record<string, unknown> }
  ) {
    if (!recipient.userId) return;

    let content = step.customContent || "";

    if (step.templateId) {
      const template = await storage.getNotificationTemplate(step.templateId);
      if (template) {
        const rendered = notificationService.renderTemplate(template, recipient.metadata || {});
        content = rendered.content;
      }
    }

    await storage.createNotification({
      channel: "in_app",
      recipientId: recipient.userId,
      recipientEmail: recipient.email,
      content,
      status: "sent",
      templateId: step.templateId || null,
      variables: recipient.metadata || {},
      subject: null,
      scheduledFor: null,
    });
  }

  private async calculateRunStats(runId: number): Promise<{ sentCount: number; failedCount: number }> {
    const recipients = await storage.getCampaignRecipients(runId);
    return {
      sentCount: recipients.filter(r => r.status === "sent").length,
      failedCount: recipients.filter(r => r.status === "failed").length,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const campaignService = new CampaignService();
