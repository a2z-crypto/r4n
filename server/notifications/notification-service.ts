import { templateService } from "./template-service";
import { smtpService, type SendResult } from "./smtp-service";
import type { 
  DbNotificationTemplate, 
  DbNotification, 
  DbSmtpConfig,
  NotificationChannel,
  DeliveryStatus
} from "@shared/schema";

export interface SendNotificationOptions {
  templateId?: number;
  channel?: NotificationChannel;
  recipientId?: string;
  recipientEmail?: string;
  subject?: string;
  content?: string;
  variables?: Record<string, unknown>;
  scheduledFor?: Date;
}

export interface NotificationDeliveryResult {
  success: boolean;
  notificationId?: number;
  error?: string;
  status: DeliveryStatus;
}

export interface NotificationProvider {
  channel: NotificationChannel;
  send(notification: {
    to: string;
    subject?: string;
    content: string;
  }): Promise<SendResult>;
}

export class NotificationService {
  private providers: Map<NotificationChannel, NotificationProvider> = new Map();

  constructor() {
    this.registerDefaultProviders();
  }

  private registerDefaultProviders(): void {
    this.providers.set("email", {
      channel: "email",
      send: async (notification) => {
        return smtpService.sendEmail({
          to: notification.to,
          subject: notification.subject || "Notification",
          html: notification.content,
        });
      },
    });

    this.providers.set("in_app", {
      channel: "in_app",
      send: async () => {
        return { success: true };
      },
    });
  }

  registerProvider(provider: NotificationProvider): void {
    this.providers.set(provider.channel, provider);
  }

  getProvider(channel: NotificationChannel): NotificationProvider | undefined {
    return this.providers.get(channel);
  }

  hasProvider(channel: NotificationChannel): boolean {
    return this.providers.has(channel);
  }

  renderTemplate(
    template: DbNotificationTemplate,
    variables: Record<string, unknown>
  ): { subject?: string; content: string } {
    const templateVars = (template.variables as Array<{ name: string; defaultValue?: string }>) || [];
    const mergedVars = templateService.applyDefaults(variables, templateVars);
    
    return templateService.render({
      content: template.content,
      subject: template.subject || undefined,
      variables: mergedVars,
    });
  }

  async deliverNotification(
    notification: DbNotification,
    template?: DbNotificationTemplate | null
  ): Promise<NotificationDeliveryResult> {
    const channel = notification.channel as NotificationChannel;
    const provider = this.getProvider(channel);

    if (!provider) {
      return {
        success: false,
        error: `No provider registered for channel: ${channel}`,
        status: "failed",
      };
    }

    try {
      if (channel === "email") {
        if (!smtpService.isConfigured()) {
          return {
            success: false,
            error: "SMTP not configured",
            status: "failed",
          };
        }

        const toEmail = notification.recipientEmail;
        if (!toEmail) {
          return {
            success: false,
            error: "No recipient email provided",
            status: "failed",
          };
        }

        const result = await provider.send({
          to: toEmail,
          subject: notification.subject || "Notification",
          content: notification.content,
        });

        return {
          success: result.success,
          notificationId: notification.id,
          error: result.error,
          status: result.success ? "sent" : "failed",
        };
      }

      const result = await provider.send({
        to: notification.recipientId || "",
        subject: notification.subject || undefined,
        content: notification.content,
      });

      return {
        success: result.success,
        notificationId: notification.id,
        error: result.error,
        status: result.success ? "delivered" : "failed",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown delivery error",
        status: "failed",
      };
    }
  }

  configureSmtp(config: DbSmtpConfig): void {
    smtpService.configure({
      host: config.host,
      port: config.port,
      secure: config.secure || false,
      username: config.username,
      password: config.password,
      fromEmail: config.fromEmail,
      fromName: config.fromName,
    });
  }

  clearSmtp(): void {
    smtpService.disconnect();
  }

  async testSmtpConnection(): Promise<{ success: boolean; error?: string }> {
    return smtpService.verifyConnection();
  }

  async sendEmailWithConfig(
    config: DbSmtpConfig, 
    message: { to: string; subject: string; html: string }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    // Create a temporary transporter for this specific config
    const nodemailer = await import("nodemailer");
    
    // Auto-correct secure setting based on port to prevent TLS mismatch errors
    // Port 465: SSL from start (secure: true)
    // Port 587: STARTTLS after connection (secure: false)
    let secure = config.secure || false;
    if (config.port === 465) {
      secure = true;
    } else if (config.port === 587 || config.port === 25) {
      secure = false;
    }
    
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: secure,
      auth: config.username && config.password ? {
        user: config.username,
        pass: config.password,
      } : undefined,
    });

    try {
      const fromAddress = config.fromName 
        ? `"${config.fromName}" <${config.fromEmail}>`
        : config.fromEmail;

      const result = await transporter.sendMail({
        from: fromAddress,
        to: message.to,
        subject: message.subject,
        html: message.html,
      });

      transporter.close();
      return { success: true, messageId: result.messageId };
    } catch (error) {
      transporter.close();
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error sending email",
      };
    }
  }

  previewTemplate(
    content: string,
    subject: string | undefined,
    variables: Record<string, unknown>
  ): { subject?: string; content: string } {
    return templateService.render({ content, subject, variables });
  }

  extractTemplateVariables(content: string): string[] {
    return templateService.extractVariables(content);
  }
}

export const notificationService = new NotificationService();
