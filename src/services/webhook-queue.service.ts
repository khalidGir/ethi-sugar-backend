import logger from '../config/logger';

export interface WebhookJob {
  id: string;
  eventType: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  lastAttempt: Date | null;
}

class WebhookQueue {
  private queue: WebhookJob[] = [];
  private readonly maxAttempts = 3;
  private retryDelays = [60000, 300000, 900000]; // 1min, 5min, 15min
  private processing = false;

  constructor() {
    this.startProcessor();
  }

  addJob(eventType: string, payload: unknown): string {
    const job: WebhookJob = {
      id: crypto.randomUUID(),
      eventType,
      payload,
      attempts: 0,
      maxAttempts: this.maxAttempts,
      createdAt: new Date(),
      lastAttempt: null,
    };

    this.queue.push(job);
    logger.info({ jobId: job.id, eventType }, 'Webhook job queued');

    return job.id;
  }

  private async processJob(job: WebhookJob): Promise<void> {
    const webhookUrl = this.getWebhookUrl(job.eventType);
    
    if (!webhookUrl) {
      logger.warn({ jobId: job.id, eventType: job.eventType }, 'No webhook URL configured, skipping');
      return;
    }

    job.attempts++;
    job.lastAttempt = new Date();

    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job.payload),
      });

      if (response.ok) {
        logger.info({ jobId: job.id, eventType: job.eventType, attempts: job.attempts }, 'Webhook delivered successfully');
        this.removeJob(job.id);
      } else {
        logger.warn({ jobId: job.id, status: response.status }, 'Webhook failed');
        this.handleRetry(job);
      }
    } catch (error) {
      logger.error({ jobId: job.id, error }, 'Webhook request failed');
      this.handleRetry(job);
    }
  }

  private handleRetry(job: WebhookJob): void {
    if (job.attempts >= job.maxAttempts) {
      logger.error({ jobId: job.id, attempts: job.attempts }, 'Webhook job failed after max attempts');
      this.removeJob(job.id);
      return;
    }

    const delay = this.retryDelays[job.attempts - 1] || this.retryDelays[this.retryDelays.length - 1];
    
    setTimeout(() => {
      this.processJob(job);
    }, delay);

    logger.info({ jobId: job.id, attempt: job.attempts, maxAttempts: job.maxAttempts, nextRetryIn: delay }, 'Webhook job scheduled for retry');
  }

  private getWebhookUrl(eventType: string): string | null {
    switch (eventType) {
      case 'IRRIGATION_CRITICAL':
        return process.env.N8N_WEBHOOK_IRRIGATION || null;
      case 'INCIDENT_CREATED':
        return process.env.N8N_WEBHOOK_INCIDENT || null;
      default:
        return null;
    }
  }

  private removeJob(id: string): void {
    this.queue = this.queue.filter(job => job.id !== id);
  }

  private startProcessor(): void {
    if (this.processing) return;
    this.processing = true;

    setInterval(async () => {
      const pendingJobs = this.queue.filter(job => 
        job.attempts === 0 || 
        (job.lastAttempt && Date.now() - job.lastAttempt.getTime() > 60000)
      );

      for (const job of pendingJobs) {
        if (job.attempts === 0) {
          await this.processJob(job);
        }
      }
    }, 30000);
  }

  getQueueStatus(): { pending: number; total: number } {
    return {
      pending: this.queue.length,
      total: this.queue.reduce((sum, job) => sum + job.attempts, 0),
    };
  }
}

export const webhookQueue = new WebhookQueue();

export function queueWebhook(eventType: string, payload: unknown): string {
  return webhookQueue.addJob(eventType, payload);
}
