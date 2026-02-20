import prisma from '../../../config/database';
import logger from '../../../config/logger';

interface WebhookPayload {
  eventType: string;
  data: unknown;
  timestamp: string;
}

export const triggerIncidentWebhook = async (incident: {
  id: string;
  type: string;
  severity: string;
  description: string;
  status: string;
  field: { id: string; name: string };
  createdAt: Date;
}): Promise<void> => {
  const webhookUrl = process.env.N8N_WEBHOOK_INCIDENT;
  
  if (!webhookUrl || webhookUrl.includes('your-n8n-instance')) {
    logger.info({ incidentId: incident.id }, 'n8n webhook skipped - no valid URL configured');
    return;
  }

  const payload: WebhookPayload = {
    eventType: 'INCIDENT_CREATED',
    data: incident,
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    await prisma.notificationLog.create({
      data: {
        eventType: 'INCIDENT_WEBHOOK',
        relatedEntityId: incident.id,
        deliveryStatus: response.ok ? 'DELIVERED' : 'FAILED',
      },
    });

    logger.info({ incidentId: incident.id, status: response.status }, 'Incident webhook triggered');
  } catch (error) {
    logger.error({ error, incidentId: incident.id }, 'Failed to trigger incident webhook');
    
    await prisma.notificationLog.create({
      data: {
        eventType: 'INCIDENT_WEBHOOK',
        relatedEntityId: incident.id,
        deliveryStatus: 'FAILED',
      },
    });
  }
};

export const triggerIrrigationWebhook = async (log: {
  id: string;
  fieldId: string;
  moistureDeficit: number;
  createdAt: Date;
}, status: string): Promise<void> => {
  const webhookUrl = process.env.N8N_WEBHOOK_IRRIGATION;
  
  if (!webhookUrl || webhookUrl.includes('your-n8n-instance')) {
    logger.info({ irrigationLogId: log.id }, 'n8n webhook skipped - no valid URL configured');
    return;
  }

  const field = await prisma.field.findUnique({ where: { id: log.fieldId } });

  const payload: WebhookPayload = {
    eventType: 'IRRIGATION_CRITICAL',
    data: {
      ...log,
      status,
      fieldName: field?.name,
    },
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    await prisma.notificationLog.create({
      data: {
        eventType: 'IRRIGATION_WEBHOOK',
        relatedEntityId: log.id,
        deliveryStatus: response.ok ? 'DELIVERED' : 'FAILED',
      },
    });

    logger.info({ irrigationLogId: log.id, status: response.status }, 'Irrigation webhook triggered');
  } catch (error) {
    logger.error({ error, irrigationLogId: log.id }, 'Failed to trigger irrigation webhook');
    
    await prisma.notificationLog.create({
      data: {
        eventType: 'IRRIGATION_WEBHOOK',
        relatedEntityId: log.id,
        deliveryStatus: 'FAILED',
      },
    });
  }
};
