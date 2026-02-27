import prisma from '../config/database';
import logger from '../config/logger';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8376747219:AAF9fqRTMf3zPSb4QvH-4kNulERugq2Xe3Q';

async function sendTelegramMessage(chatId: string | number, text: string) {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
      }),
    });
  } catch (error) {
    logger.error({ error, chatId }, 'Failed to send Telegram message');
  }
}

export const sendApprovalNotification = async (
  type: string,
  referenceId: string,
  requestedByName: string
) => {
  try {
    const typeLabels: Record<string, string> = {
      CROP_PLAN: '🌾 Crop Plan',
      FERTILIZER: '🧪 Fertilizer Application',
      IRRIGATION: '💧 Irrigation',
      BUDGET: '💰 Budget Request',
      DISEASE_ALERT: '⚠️ Disease Alert',
      SOIL_DATA: '📊 Soil Data',
      AI_RECOMMENDATION: '🤖 AI Recommendation',
    };

    let targetRole: string = 'MANAGER';
    if (type === 'DISEASE_ALERT') {
      targetRole = 'AGRONOMIST';
    }

    const targetUsers = await prisma.user.findMany({
      where: { 
        role: targetRole as any,
        telegramUsername: { not: null }
      },
      select: { id: true, telegramUsername: true },
    });

    if (targetUsers.length === 0) {
      logger.warn({ type, referenceId }, 'No users with Telegram found to notify');
      return;
    }

    const message = `
🔔 <b>New Approval Required</b>

<b>Type:</b> ${typeLabels[type] || type}
<b>Requested by:</b> ${requestedByName}
<b>Reference ID:</b> ${referenceId}

Please review and approve/reject in the system.
    `.trim();

    for (const user of targetUsers) {
      if (user.telegramUsername) {
        await sendTelegramMessage(user.telegramUsername, message);
        logger.info({ userId: user.id, type }, 'Telegram notification sent');
      }
    }
  } catch (error) {
    logger.error({ error, type, referenceId }, 'Failed to send approval notification');
  }
};

export const sendDecisionNotification = async (
  type: string,
  referenceId: string,
  status: 'APPROVED' | 'REJECTED',
  decidedByName: string,
  reason?: string
) => {
  try {
    const typeLabels: Record<string, string> = {
      CROP_PLAN: 'Crop Plan',
      FERTILIZER: 'Fertilizer Application',
      IRRIGATION: 'Irrigation',
      BUDGET: 'Budget Request',
      DISEASE_ALERT: 'Disease Alert',
      SOIL_DATA: 'Soil Data',
      AI_RECOMMENDATION: 'AI Recommendation',
    };

    const approval = await prisma.approval.findFirst({
      where: { referenceId, type },
      select: { requestedById: true }
    });

    if (!approval) return;

    const requester = await prisma.user.findUnique({
      where: { id: approval.requestedById },
      select: { telegramUsername: true }
    });

    if (!requester || !requester.telegramUsername) {
      logger.warn({ type, referenceId }, 'Requester not found or no Telegram');
      return;
    }

    const statusEmoji = status === 'APPROVED' ? '✅' : '❌';
    const message = `
${statusEmoji} <b>Approval ${status}</b>

<b>Type:</b> ${typeLabels[type] || type}
<b>Reference ID:</b> ${referenceId}
<b>Decided by:</b> ${decidedByName}
${reason ? `<b>Reason:</b> ${reason}` : ''}
    `.trim();

    await sendTelegramMessage(requester.telegramUsername, message);
    logger.info({ requestedById: approval.requestedById, type, status }, 'Decision notification sent');
  } catch (error) {
    logger.error({ error, type, referenceId, status }, 'Failed to send decision notification');
  }
};
