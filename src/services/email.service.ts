import nodemailer from 'nodemailer';
import logger from '../config/logger';

export interface Attachment {
  filename: string;
  content?: Buffer;
  path?: string;
  contentType?: string;
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
}

export interface DailyReport {
  date: string;
  tasksCompleted: number;
  workerLogsCount: number;
  totalHoursWorked: number;
  incidentsReported: number;
  weatherSummary?: string;
}

export interface WeeklyReport {
  weekNumber: number;
  year: number;
  taskCompletionRate: number;
  totalHoursWorked: number;
  incidentsCount: number;
  rainfallTotal: number;
}

export interface AlertData {
  type: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  entity?: {
    type: string;
    id: string;
    name: string;
  };
  actionRequired?: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private configured: boolean = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
      logger.warn('Email service not configured. SMTP settings missing.');
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(smtpPort || '587'),
        secure: smtpPort === '465',
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      this.configured = true;
      logger.info('Email service configured successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to configure email service');
    }
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.configured || !this.transporter) {
      logger.warn('Email service not configured. Skipping email send.');
      logger.info({ to: options.to, subject: options.subject }, 'Email would have been sent');
      return;
    }

    const from = process.env.SMTP_FROM || '"EthioSugar Farm" <noreply@ethiosugar.com>';

    try {
      const info = await this.transporter.sendMail({
        from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text || this.htmlToText(options.html),
        html: options.html,
        attachments: options.attachments,
      });

      logger.info({ messageId: info.messageId, to: options.to }, 'Email sent successfully');
    } catch (error) {
      logger.error({ error, to: options.to, subject: options.subject }, 'Failed to send email');
      throw error;
    }
  }

  async sendDailyReport(recipients: string[], report: DailyReport): Promise<void> {
    const subject = `Daily Activity Report - ${report.date}`;
    const html = this.generateDailyReportHtml(report);

    await this.sendEmail({
      to: recipients,
      subject,
      html,
    });
  }

  async sendWeeklyReport(recipients: string[], report: WeeklyReport): Promise<void> {
    const subject = `Weekly Field Report - Week ${report.weekNumber}, ${report.year}`;
    const html = this.generateWeeklyReportHtml(report);

    await this.sendEmail({
      to: recipients,
      subject,
      html,
    });
  }

  async sendAlert(recipients: string[], alert: AlertData): Promise<void> {
    const subject = `[${alert.type}] ${alert.title}`;
    const html = this.generateAlertHtml(alert);

    await this.sendEmail({
      to: recipients,
      subject,
      html,
    });
  }

  private generateDailyReportHtml(report: DailyReport): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #2c5f2d; color: white; padding: 20px; text-align: center; }
          .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
          .stat-card { background: #f4f4f4; padding: 15px; border-radius: 8px; text-align: center; }
          .stat-value { font-size: 24px; font-weight: bold; color: #2c5f2d; }
          .stat-label { font-size: 14px; color: #666; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Daily Activity Report</h1>
            <p>${report.date}</p>
          </div>
          
          <div class="stats">
            <div class="stat-card">
              <div class="stat-value">${report.tasksCompleted}</div>
              <div class="stat-label">Tasks Completed</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${report.workerLogsCount}</div>
              <div class="stat-label">Worker Logs</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${report.totalHoursWorked.toFixed(1)}</div>
              <div class="stat-label">Hours Worked</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${report.incidentsReported}</div>
              <div class="stat-label">Incidents</div>
            </div>
          </div>
          
          ${report.weatherSummary ? `<p><strong>Weather Summary:</strong> ${report.weatherSummary}</p>` : ''}
          
          <div class="footer">
            <p>EthioSugar Farm Management System</p>
            <p>This is an automated report. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateWeeklyReportHtml(report: WeeklyReport): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1a5276; color: white; padding: 20px; text-align: center; }
          .metric { margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 8px; }
          .metric-label { font-size: 14px; color: #666; }
          .metric-value { font-size: 20px; font-weight: bold; color: #1a5276; }
          .progress-bar { width: 100%; height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden; margin: 10px 0; }
          .progress-fill { height: 100%; background: #27ae60; transition: width 0.3s; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Weekly Field Report</h1>
            <p>Week ${report.weekNumber}, ${report.year}</p>
          </div>
          
          <div class="metric">
            <div class="metric-label">Task Completion Rate</div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${report.taskCompletionRate}%"></div>
            </div>
            <div class="metric-value">${report.taskCompletionRate}%</div>
          </div>
          
          <div class="metric">
            <div class="metric-label">Total Hours Worked</div>
            <div class="metric-value">${report.totalHoursWorked.toFixed(1)} hours</div>
          </div>
          
          <div class="metric">
            <div class="metric-label">Incidents Reported</div>
            <div class="metric-value">${report.incidentsCount}</div>
          </div>
          
          <div class="metric">
            <div class="metric-label">Total Rainfall</div>
            <div class="metric-value">${report.rainfallTotal.toFixed(1)} mm</div>
          </div>
          
          <div class="footer">
            <p>EthioSugar Farm Management System</p>
            <p>This is an automated report. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateAlertHtml(alert: AlertData): string {
    const colors = {
      CRITICAL: '#c0392b',
      WARNING: '#f39c12',
      INFO: '#3498db',
    };

    const icons = {
      CRITICAL: '🚨',
      WARNING: '⚠️',
      INFO: 'ℹ️',
    };

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .alert-header { padding: 20px; border-radius: 8px; color: white; text-align: center; }
          .content { padding: 20px; background: #f8f9fa; margin: 20px 0; border-radius: 8px; }
          .entity-info { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .action-required { background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #f39c12; margin: 15px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="alert-header" style="background: ${colors[alert.type]}">
            <h1>${icons[alert.type]} ${alert.title}</h1>
            <p>${alert.type} Alert</p>
          </div>
          
          <div class="content">
            <p>${alert.message}</p>
          </div>
          
          ${alert.entity ? `
            <div class="entity-info">
              <strong>Related ${alert.entity.type}:</strong><br>
              ${alert.entity.name} (ID: ${alert.entity.id})
            </div>
          ` : ''}
          
          ${alert.actionRequired ? `
            <div class="action-required">
              <strong>Action Required:</strong><br>
              ${alert.actionRequired}
            </div>
          ` : ''}
          
          <div class="footer">
            <p>EthioSugar Farm Management System - Automated Alert</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private htmlToText(html: string): string {
    // Simple HTML to text conversion
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const emailService = new EmailService();
export default emailService;
