import nodemailer, { Transporter } from "nodemailer";

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  username?: string | null;
  password?: string | null;
  fromEmail: string;
  fromName?: string | null;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class SmtpService {
  private transporter: Transporter | null = null;
  private settings: SmtpSettings | null = null;

  configure(settings: SmtpSettings): void {
    this.settings = settings;
    
    // Auto-correct secure setting based on port to prevent TLS mismatch errors
    // Port 465: SSL from start (secure: true)
    // Port 587: STARTTLS after connection (secure: false)
    // Port 25: Usually no TLS (secure: false)
    let secure = settings.secure;
    if (settings.port === 465) {
      secure = true;
    } else if (settings.port === 587 || settings.port === 25) {
      secure = false;
    }
    
    this.transporter = nodemailer.createTransport({
      host: settings.host,
      port: settings.port,
      secure: secure,
      auth: settings.username && settings.password ? {
        user: settings.username,
        pass: settings.password,
      } : undefined,
    });
  }

  isConfigured(): boolean {
    return this.transporter !== null && this.settings !== null;
  }

  async sendEmail(message: EmailMessage): Promise<SendResult> {
    if (!this.transporter || !this.settings) {
      return {
        success: false,
        error: "SMTP not configured",
      };
    }

    try {
      const fromAddress = this.settings.fromName 
        ? `"${this.settings.fromName}" <${this.settings.fromEmail}>`
        : this.settings.fromEmail;

      const result = await this.transporter.sendMail({
        from: fromAddress,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text || this.htmlToText(message.html),
      });

      return {
        success: true,
        messageId: result.messageId,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error sending email",
      };
    }
  }

  async verifyConnection(): Promise<{ success: boolean; error?: string }> {
    if (!this.transporter) {
      return { success: false, error: "SMTP not configured" };
    }

    try {
      await this.transporter.verify();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "SMTP verification failed",
      };
    }
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  disconnect(): void {
    if (this.transporter) {
      this.transporter.close();
      this.transporter = null;
    }
    this.settings = null;
  }
}

export const smtpService = new SmtpService();
