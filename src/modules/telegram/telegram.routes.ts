import { Router, Response } from 'express';
import prisma from '../../config/database';
import { successResponse, errorResponse } from '../../utils/response';
import logger from '../../config/logger';

const router = Router();

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8376747219:AAF9fqRTMf3zPSb4QvH-4kNulERugq2Xe3Q';
const ADMIN_TELEGRAM_ID = process.env.ADMIN_TELEGRAM_ID || 'Khalidblabla';

interface TelegramMessage {
  message_id?: number;
  chat: { id: number | string; username?: string };
  from?: { id: number; username?: string };
  text?: string;
  photo?: { file_id: string }[];
}

interface TelegramUpdate {
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

async function sendTelegramMessage(chatId: string | number, text: string) {
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
}

async function sendTelegramPhoto(chatId: string | number, photo: string, caption?: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo,
      caption,
      parse_mode: 'HTML',
    }),
  });
}

router.post('/webhook', async (req: any, res: Response) => {
  try {
    const update: TelegramUpdate = req.body;
    const message = update.message;

    if (!message) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text || '';
    const username = message.from?.username || message.chat.username || 'Unknown';

    logger.info({ chatId, username, text }, 'Telegram webhook received');

    if (text === '/start' || text === '/help') {
      const helpText = `
👋 <b>Welcome to EthioSugar Bot!</b>

Available commands:
/tasks - View today's tasks
/done &lt;task_id&gt; - Mark task complete
/status - My task status
/upload - Upload disease image
/help - Show this help
      `;
      await sendTelegramMessage(chatId, helpText);
      return res.status(200).json({ ok: true });
    }

    if (text === '/tasks') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const tasks = await prisma.task.findMany({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow,
          },
        },
        include: {
          assignedTo: {
            select: { id: true, fullName: true, email: true },
          },
          field: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (tasks.length === 0) {
        await sendTelegramMessage(chatId, '✅ No tasks scheduled for today!');
        return res.status(200).json({ ok: true });
      }

      let messageText = '📋 <b>Today\'s Tasks</b>\n\n';
      
      const workers = await prisma.user.findMany({
        where: { role: 'WORKER', isActive: true },
        select: { id: true, fullName: true },
      });

      for (const worker of workers) {
        const workerTasks = tasks.filter(t => t.assignedToId === worker.id);
        if (workerTasks.length > 0) {
          messageText += `<b>👷 ${worker.fullName}</b>\n`;
          for (const task of workerTasks) {
            const emoji = task.status === 'COMPLETED' ? '✅' : '⏳';
            messageText += `${emoji} ${task.title}\n`;
            messageText += `   📍 ${task.field?.name || 'Unknown field'}\n`;
          }
          messageText += '\n';
        }
      }

      const unassigned = tasks.filter(t => !t.assignedToId);
      if (unassigned.length > 0) {
        messageText += '<b>📌 Unassigned</b>\n';
        for (const task of unassigned) {
          messageText += `⏳ ${task.title}\n`;
          messageText += `   📍 ${task.field?.name || 'Unknown field'}\n`;
        }
      }

      await sendTelegramMessage(chatId, messageText);
      return res.status(200).json({ ok: true });
    }

    if (text.startsWith('/done ')) {
      const taskId = text.replace('/done ', '').trim();
      
      const task = await prisma.task.findUnique({ where: { id: taskId } });
      
      if (!task) {
        await sendTelegramMessage(chatId, '❌ Task not found!');
        return res.status(200).json({ ok: true });
      }

      await prisma.task.update({
        where: { id: taskId },
        data: { status: 'COMPLETED' },
      });

      await sendTelegramMessage(chatId, `✅ Task "${task.title}" marked as complete!`);
      
      await sendTelegramMessage(
        ADMIN_TELEGRAM_ID, 
        `✅ Task completed: ${task.title}\nBy: @${username}`
      );
      
      return res.status(200).json({ ok: true });
    }

    if (text === '/status') {
      const user = await prisma.user.findFirst({
        where: { 
          OR: [
            { telegramUsername: username },
            { email: { contains: username } },
          ],
        },
      });

      if (!user) {
        await sendTelegramMessage(chatId, '❌ User not found. Please contact admin.');
        return res.status(200).json({ ok: true });
      }

      const myTasks = await prisma.task.findMany({
        where: {
          assignedToId: user.id,
          status: 'OPEN',
        },
        include: {
          field: { select: { name: true } },
        },
      });

      if (myTasks.length === 0) {
        await sendTelegramMessage(chatId, '✅ No pending tasks!');
        return res.status(200).json({ ok: true });
      }

      let messageText = '📋 <b>Your Pending Tasks</b>\n\n';
      for (const task of myTasks) {
        messageText += `• ${task.title} (${task.field?.name})\n`;
        if (task.dueDate) {
          messageText += `   Due: ${new Date(task.dueDate).toLocaleDateString()}\n`;
        }
      }

      await sendTelegramMessage(chatId, messageText);
      return res.status(200).json({ ok: true });
    }

    if (text === '/upload') {
      const uploadInstruction = `
📷 <b>Upload Disease Image</b>

Please upload a photo of the plant/leaf you want to analyze.

I'll identify potential diseases and provide recommendations.
      `;
      await sendTelegramMessage(chatId, uploadInstruction);
      return res.status(200).json({ ok: true });
    }

    if (message.photo && message.photo.length > 0) {
      const photoId = message.photo[message.photo.length - 1].file_id;
      
      await sendTelegramMessage(chatId, '🔍 Analyzing image for disease detection...');
      
      await sendTelegramMessage(
        ADMIN_TELEGRAM_ID,
        `🔬 <b>New Disease Image Submitted</b>\nBy: @${username}\nPhoto ID: ${photoId}`
      );

      const responseText = `
🔬 <b>Disease Analysis</b>

Thanks for the image! This is a demo response.

For full disease detection:
1. Image is forwarded to AI model
2. Analysis will be sent to agronomist
3. If disease confirmed, incident will be created

<i>(Full HuggingFace integration coming soon)</i>
      `;
      await sendTelegramMessage(chatId, responseText);
      return res.status(200).json({ ok: true });
    }

    await sendTelegramMessage(chatId, '❓ Unknown command. Type /help for available commands.');
    
    return res.status(200).json({ ok: true });
  } catch (error) {
    logger.error({ error }, 'Telegram webhook error');
    return res.status(200).json({ ok: true });
  }
});

router.post('/send', async (req: any, res: Response) => {
  try {
    const { chatId, message } = req.body;
    
    if (!chatId || !message) {
      return errorResponse(res, 'chatId and message are required', 'VALIDATION_ERROR', 400);
    }

    await sendTelegramMessage(chatId, message);
    return successResponse(res, { sent: true }, 'Message sent');
  } catch (error) {
    logger.error({ error }, 'Failed to send telegram message');
    return errorResponse(res, 'Failed to send message');
  }
});

router.get('/health', (req, res: Response) => {
  res.status(200).json({ status: 'ok', bot: 'EthioSugar Bot' });
});

export default router;
